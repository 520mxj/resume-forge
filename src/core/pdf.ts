import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// worker 用 Vite 的 asset 处理，打包后路径跟着 base 走
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

export interface RawLine {
  text: string;
  /** 距页面左边缘，pt */
  x: number;
  /** 距页面顶边，pt */
  y: number;
  /** 行高估算，pt */
  size: number;
  bold: boolean;
  page: number;
  /** 同一视觉行里的分段（用于识别左右分栏） */
  segments: { text: string; x: number; width: number }[];
}

export interface PdfExtraction {
  lines: RawLine[];
  pages: number;
  pageWidth: number;
  pageHeight: number;
  thumbs: string[];
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

interface Frag {
  str: string;
  x: number;
  width: number;
  size: number;
  bold: boolean;
}

function buildLine(frags: Frag[], page: number, y: number): RawLine {
  frags.sort((a, b) => a.x - b.x);
  const size = Math.max(...frags.map((f) => f.size));
  let text = '';
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (const frag of frags) {
    if (!frag.str) continue;
    const gap = frag.x - prevEnd;
    const prevChar = text[text.length - 1] ?? '';
    const nextChar = frag.str[0] ?? '';
    const bothCjk = /[\u4e00-\u9fa5]/.test(prevChar) && /[\u4e00-\u9fa5]/.test(nextChar);
    if (text && !bothCjk && gap > Math.max(0.8, size * 0.16)) text += ' ';
    text += frag.str;
    prevEnd = frag.x + frag.width;
  }
  return {
    text: text
      .replace(/\s+/g, ' ')
      .replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')
      .trim(),
    x: frags[0]?.x ?? 0,
    y,
    size,
    bold: frags.some((f) => f.bold),
    page,
    segments: frags.map((f) => ({ text: f.str.trim(), x: f.x, width: f.width })),
  };
}

/** 把一行按过宽的水平空隙切成左右分栏片段 */
function splitSegments(frags: Frag[], lineWidth: number): Frag[][] {
  const gapThreshold = Math.max(24, lineWidth * 0.1);
  const sorted = [...frags].sort((a, b) => a.x - b.x);
  const groups: Frag[][] = [];
  let current: Frag[] = [];
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (const frag of sorted) {
    if (current.length && frag.x - prevEnd > gapThreshold) {
      groups.push(current);
      current = [];
    }
    current.push(frag);
    prevEnd = frag.x + frag.width;
  }
  if (current.length) groups.push(current);
  return groups;
}

/** 判断是否左右双栏：按行起始 x 聚类，找最明显的列间隙 */
function detectColumnSplit(lines: RawLine[], pageWidth: number): number | null {
  if (lines.length < 8) return null;
  const xs = lines.map((l) => l.x).sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of xs) {
    const cur = clusters[clusters.length - 1];
    if (cur && x - cur[cur.length - 1] <= 12) cur.push(x);
    else clusters.push([x]);
  }
  const stats = clusters
    .map((c) => ({ x: c.reduce((a, b) => a + b, 0) / c.length, n: c.length }))
    .filter((c) => c.n / lines.length >= 0.15);
  if (stats.length < 2) return null;

  let best: { gap: number; at: number } | null = null;
  for (let i = 1; i < stats.length; i++) {
    const gap = stats[i].x - stats[i - 1].x;
    if (gap > Math.max(40, pageWidth * 0.12) && (!best || gap > best.gap)) {
      best = { gap, at: (stats[i].x + stats[i - 1].x) / 2 };
    }
  }
  return best ? best.at : null;
}

export async function extractPdf(
  file: File,
  onProgress?: (stage: string, ratio: number) => void,
): Promise<PdfExtraction> {
  const buffer = await file.arrayBuffer();
  let doc: PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: `${ASSET_BASE}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
      isEvalSupported: false,
    }).promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF 打开失败（可能加密或损坏）：${msg}`);
  }

  const perPage: RawLine[][] = [];
  let pageWidth = 595;
  let pageHeight = 842;

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(`解析第 ${p}/${doc.numPages} 页`, (p - 1) / Math.max(1, doc.numPages));
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    pageWidth = viewport.width;
    pageHeight = viewport.height;
    const content = await page.getTextContent();
    const items = (content.items as unknown as PdfTextItem[]).filter(
      (i) => typeof i.str === 'string' && Array.isArray(i.transform),
    );
    if (!items.length) continue;

    const frags: (Frag & { y: number })[] = items.map((item) => {
      const [, , c, d, e, f] = item.transform;
      const size = Math.hypot(c, d) || item.height || 10;
      return {
        str: item.str,
        x: e,
        width: item.width ?? 0,
        size,
        bold: /bold|black|heavy|semibold|demi|黑体|hei/i.test(item.fontName ?? ''),
        y: viewport.height - f,
      };
    });

    // 按 y 聚成视觉行
    frags.sort((m, n) => m.y - n.y || m.x - n.x);
    const rows: (Frag & { y: number })[][] = [];
    let currentRow: (Frag & { y: number })[] = [];
    let rowY = Number.NaN;
    for (const frag of frags) {
      const tolerance = Math.max(1.6, frag.size * 0.45);
      if (!currentRow.length || Math.abs(frag.y - rowY) <= tolerance) {
        if (!currentRow.length) rowY = frag.y;
        currentRow.push(frag);
      } else {
        rows.push(currentRow);
        currentRow = [frag];
        rowY = frag.y;
      }
    }
    if (currentRow.length) rows.push(currentRow);

    const lines: RawLine[] = [];
    for (const row of rows) {
      const y = Math.min(...row.map((r) => r.y));
      const groups = splitSegments(row, pageWidth);
      const merged = buildLine(row, p, y);
      if (!merged.text) continue;
      merged.segments = groups.map((g) => {
        const sorted = [...g].sort((a2, b2) => a2.x - b2.x);
        const last = sorted[sorted.length - 1];
        return {
          text: sorted.map((s) => s.str).join('').trim(),
          x: sorted[0].x,
          width: last.x + last.width - sorted[0].x,
        };
      });
      lines.push(merged);
    }
    perPage.push(lines);
  }

  // 双栏文档：把每行按列拆开重排，否则两栏内容会交错成乱句
  const allLines = perPage.flat();
  const splitX = detectColumnSplit(allLines, pageWidth);
  let ordered: RawLine[];
  if (splitX !== null) {
    ordered = [];
    for (const pageLines of perPage) {
      const left: RawLine[] = [];
      const right: RawLine[] = [];
      for (const line of pageLines) {
        const leftParts = line.segments.filter((s) => s.x < splitX);
        const rightParts = line.segments.filter((s) => s.x >= splitX);
        if (leftParts.length) {
          left.push({
            ...line,
            text: leftParts.map((s) => s.text).join(' ').trim(),
            x: leftParts[0].x,
            segments: leftParts,
          });
        }
        if (rightParts.length) {
          right.push({
            ...line,
            text: rightParts.map((s) => s.text).join(' ').trim(),
            x: rightParts[0].x,
            segments: rightParts,
          });
        }
      }
      ordered.push(...left.filter((l) => l.text), ...right.filter((l) => l.text));
    }
  } else {
    ordered = allLines;
  }

  const thumbs = await renderThumbs(doc);
  onProgress?.('解析完成', 1);
  return { lines: ordered, pages: doc.numPages, pageWidth, pageHeight, thumbs };
}

async function renderThumbs(doc: PDFDocumentProxy): Promise<string[]> {
  const thumbs: string[] = [];
  const limit = Math.min(3, doc.numPages);
  for (let p = 1; p <= limit; p++) {
    try {
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1.1, 620 / base.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      await page.render({ canvasContext: ctx, viewport }).promise;
      thumbs.push(canvas.toDataURL('image/jpeg', 0.72));
    } catch {
      break;
    }
  }
  return thumbs;
}
