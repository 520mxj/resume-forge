import type { ResumeData, Section } from './types';
import { RESUME_CSS, renderResume } from './template';

function bulletsMd(section: Section): string[] {
  const lines: string[] = [];
  for (const e of section.entries) {
    const head = [e.title, e.subtitle].filter(Boolean).join(' · ');
    const meta = [[e.start, e.end].filter(Boolean).join(' – '), e.location].filter(Boolean).join(' · ');
    if (head) lines.push(`### ${head}`);
    if (meta) lines.push(`*${meta}*`);
    if (e.link) lines.push(`[${e.link}](${e.link.startsWith('http') ? e.link : `https://${e.link}`})`);
    if (e.tags.length) lines.push(e.tags.map((t) => `\`${t}\``).join(' '));
    if (e.description.trim()) lines.push(e.description.trim());
    for (const b of e.bullets) lines.push(`- ${b.text.trim()}`);
    lines.push('');
  }
  return lines;
}

export function toMarkdown(data: ResumeData): string {
  const { profile } = data;
  const out: string[] = [];
  out.push(`# ${profile.name || '未命名'}`);
  if (profile.headline) out.push(`**${profile.headline}**`);
  const contacts = [
    profile.phone,
    profile.email,
    profile.location,
    profile.github,
    profile.website,
    ...profile.extras.map((x) => `${x.label}: ${x.value}`),
  ].filter(Boolean);
  if (contacts.length) out.push(contacts.join(' | '));
  out.push('');

  for (const s of data.sections) {
    if (!s.visible) continue;
    out.push(`## ${s.title}`);
    if (s.kind === 'summary' && !s.entries.length && s.text.trim()) out.push(s.text.trim(), '');
    else out.push(...bulletsMd(s));
  }
  return `${out.join('\n').trim()}\n`;
}

/** 导出成 JSON Resume（jsonresume.org）标准结构，方便喂给其它工具 */
export function toJsonResume(data: ResumeData): unknown {
  const { profile } = data;
  const byKind = (kind: Section['kind']) => data.sections.filter((s) => s.kind === kind && s.visible);
  const dateText = (value: string) => {
    if (!value) return undefined;
    const m = value.match(/((?:19|20)\d{2})[.\-/年]?(0?[1-9]|1[0-2])?/);
    return m ? `${m[1]}-${(m[2] ?? '01').padStart(2, '0')}-01` : value;
  };

  const summary = byKind('summary')[0];

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: profile.name,
      label: profile.headline,
      email: profile.email,
      phone: profile.phone,
      url: profile.website,
      summary: summary?.text ?? '',
      location: { city: profile.location, countryCode: '' },
      profiles: [
        profile.github ? { network: 'GitHub', username: profile.github.replace(/^.*github\.com\//, ''), url: profile.github } : null,
        profile.linkedin ? { network: 'LinkedIn', username: profile.linkedin.replace(/^.*linkedin\.com\/in\//, ''), url: profile.linkedin } : null,
      ].filter(Boolean),
    },
    work: byKind('experience').flatMap((s) =>
      s.entries.map((e) => ({
        name: e.subtitle,
        position: e.title,
        location: e.location,
        startDate: dateText(e.start),
        endDate: dateText(e.end),
        highlights: e.bullets.map((b) => b.text),
        summary: e.description,
      })),
    ),
    education: byKind('education').flatMap((s) =>
      s.entries.map((e) => ({
        institution: e.title,
        studyType: e.subtitle,
        location: e.location,
        startDate: dateText(e.start),
        endDate: dateText(e.end),
      })),
    ),
    projects: byKind('projects').flatMap((s) =>
      s.entries.map((e) => ({
        name: e.title,
        description: e.subtitle,
        url: e.link,
        startDate: dateText(e.start),
        endDate: dateText(e.end),
        highlights: e.bullets.map((b) => b.text),
        keywords: e.tags,
      })),
    ),
    skills: byKind('skills').flatMap((s) =>
      s.entries.map((e) => ({ name: e.title || '技能', keywords: e.tags })),
    ),
    certificates: byKind('certificates').flatMap((s) =>
      s.entries.map((e) => ({ name: e.title, issuer: e.subtitle, date: e.start })),
    ),
    awards: byKind('awards').flatMap((s) =>
      s.entries.map((e) => ({ title: e.title, awarder: e.subtitle, date: e.start, summary: e.description })),
    ),
    languages: byKind('languages').flatMap((s) =>
      s.entries.map((e) => ({ language: e.title, fluency: e.tags.join(' / ') || e.subtitle })),
    ),
  };
}

export function toStandaloneHtml(data: ResumeData): string {
  const body = renderResume(data);
  const title = data.profile.name ? `${data.profile.name} · 简历` : '简历';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  * { margin: 0; padding: 0; }
  body { background: #eceae5; display: flex; justify-content: center; padding: 24px 0; font-family: "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif; }
  .rf-page { box-shadow: 0 8px 30px rgba(0,0,0,.12); }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; display: block; }
    .rf-page { box-shadow: none; width: 210mm; min-height: auto; }
    .rf-entry, .rf-skill, .rf-sec { break-inside: avoid; }
  }
  ${RESUME_CSS}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

export function downloadFile(fileName: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string, ext: string): string {
  const base = (name || '简历').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}_${stamp}.${ext}`;
}

/** 调起浏览器打印对话框，用户在「目标打印机」里选「另存为 PDF」 */
export function printResume() {
  const style = document.createElement('style');
  style.id = 'rf-print-styles';
  style.textContent = `
    @page { size: A4; margin: 0; }
    @media print {
      html, body { background: #fff !important; }
      body * { visibility: hidden !important; }
      #rf-print-area, #rf-print-area * { visibility: visible !important; }
      #rf-print-area {
        position: absolute !important; inset: 0 auto auto 0 !important;
        margin: 0 !important; padding: 0 !important;
        transform: none !important; zoom: 1 !important;
        width: 210mm !important; box-shadow: none !important;
      }
      #rf-print-area .rf-page { box-shadow: none !important; border: none !important; width: 210mm !important; min-height: auto !important; }
      .rf-entry, .rf-skill, .rf-sec { break-inside: avoid; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `;
  document.head.appendChild(style);
  window.print();
  setTimeout(() => document.getElementById('rf-print-styles')?.remove(), 800);
}
