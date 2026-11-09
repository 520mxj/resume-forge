import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractPdf } from './core/pdf';
import { parseResume } from './core/parse';
import type { ParseReport, ResumeData, ResumeDoc } from './core/types';
import { cloneSample } from './core/sample';
import {
  docLabel,
  loadActiveId,
  loadAi,
  loadDocs,
  loadUi,
  makeDoc,
  saveActiveId,
  saveAi,
  saveDocs,
  saveUi,
  type AiSettings,
  type UiSettings,
} from './core/storage';
import { downloadFile, printResume, safeFileName, toJsonResume, toMarkdown, toStandaloneHtml } from './core/exporters';
import { uid } from './core/id';
import EditorPane from './components/EditorPane';
import PreviewPane from './components/PreviewPane';
import ScorePane from './components/ScorePane';
import StylePane from './components/StylePane';
import SettingsModal from './components/SettingsModal';
import { IconCheck, IconDownload, IconFile, IconPlus, IconPrinter, IconSettings } from './components/Icons';

export function blankResume(): ResumeData {
  const entry = () => ({
    id: uid('e'),
    title: '',
    subtitle: '',
    start: '',
    end: '',
    location: '',
    link: '',
    tags: [],
    description: '',
    bullets: [],
  });
  return {
    schema: 'resume-forge/v1',
    profile: {
      name: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      github: '',
      linkedin: '',
      photo: '',
      extras: [],
    },
    sections: [
      { id: uid('s'), kind: 'experience', title: '工作经历', visible: true, entries: [entry()], text: '' },
      { id: uid('s'), kind: 'projects', title: '项目经历', visible: true, entries: [entry()], text: '' },
      { id: uid('s'), kind: 'education', title: '教育背景', visible: true, entries: [entry()], text: '' },
      { id: uid('s'), kind: 'skills', title: '专业技能', visible: true, entries: [{ ...entry(), title: '技术栈' }], text: '' },
    ],
    meta: {
      template: 'classic',
      accent: '#c2412d',
      fontScale: 1,
      lineHeight: 1.55,
      pageMargin: 18,
      showPhoto: false,
      uppercaseHeadings: false,
    },
  };
}

interface DocMeta {
  report: ParseReport | null;
  source: { fileName: string; bytes: number; pages: number; thumbs: string[] } | null;
}

type Toast = { id: number; text: string; kind: 'ok' | 'err' };

export default function App() {
  const [docs, setDocs] = useState<ResumeDoc[]>(() => loadDocs());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId());
  const [ui, setUi] = useState<UiSettings>(() => loadUi());
  const [ai, setAi] = useState<AiSettings>(() => loadAi());
  const [docMeta, setDocMeta] = useState<Record<string, DocMeta>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [jd, setJd] = useState('');
  const bootstrapped = useRef(false);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeId) ?? docs[0] ?? null,
    [docs, activeId],
  );
  const data = activeDoc?.data ?? null;
  const meta = activeDoc ? docMeta[activeDoc.id] : undefined;

  // ---- 首次进入：没有存档就放一份示例，避免空白页
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (docs.length === 0) {
      const doc = makeDoc('示例简历', cloneSample());
      setDocs([doc]);
      setActiveId(doc.id);
    } else if (!activeId) {
      setActiveId(docs[0].id);
    }
  }, [docs, activeId]);

  // ---- 持久化
  useEffect(() => {
    const timer = setTimeout(() => saveDocs(docs), 250);
    return () => clearTimeout(timer);
  }, [docs]);

  useEffect(() => saveActiveId(activeId), [activeId]);
  useEffect(() => saveUi(ui), [ui]);
  useEffect(() => saveAi(ai), [ai]);

  useEffect(() => {
    document.documentElement.dataset.theme = ui.theme;
  }, [ui.theme]);

  const showToast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    setToast({ id: Date.now(), text, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const updateData = useCallback(
    (next: ResumeData) => {
      setDocs((list) =>
        list.map((d) => (d.id === activeDoc?.id ? { ...d, data: next, updatedAt: Date.now() } : d)),
      );
    },
    [activeDoc?.id],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!/\.pdf$/i.test(file.name)) {
        showToast('只支持 PDF 文件，Word 可以先另存为 PDF 再上传', 'err');
        return;
      }
      setBusy('正在读取 PDF…');
      try {
        const extraction = await extractPdf(file, (stage) => setBusy(stage));
        if (import.meta.env.DEV) {
          (window as unknown as { __rfLines?: unknown }).__rfLines = extraction.lines;
        }
        setBusy('正在识别结构…');
        const { data: parsed, report } = parseResume(extraction);
        const doc = makeDoc(file.name.replace(/\.pdf$/i, ''), parsed);
        setDocMeta((m) => ({
          ...m,
          [doc.id]: {
            report,
            source: {
              fileName: file.name,
              bytes: file.size,
              pages: extraction.pages,
              thumbs: extraction.thumbs,
            },
          },
        }));
        setDocs((list) => [...list, doc]);
        setActiveId(doc.id);
        setMobileView('edit');
        showToast(`解析完成，识别度 ${report.confidence}%，共 ${report.stats.entries} 条经历`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : '解析失败，换一份 PDF 试试', 'err');
      } finally {
        setBusy(null);
      }
    },
    [showToast],
  );

  const newDoc = useCallback(() => {
    const doc = makeDoc('未命名简历', blankResume());
    setDocs((list) => [...list, doc]);
    setActiveId(doc.id);
    showToast('已新建空白简历');
  }, [showToast]);

  const useSample = useCallback(() => {
    const doc = makeDoc('示例简历', cloneSample());
    setDocs((list) => [...list, doc]);
    setActiveId(doc.id);
    showToast('已载入示例，可直接改字段');
  }, [showToast]);

  const removeDoc = useCallback(
    (id: string) => {
      setDocs((list) => {
        const next = list.filter((d) => d.id !== id);
        setActiveId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
        return next;
      });
      setDocMeta((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
      showToast('已删除该简历');
    },
    [showToast],
  );

  const exportAs = useCallback(
    (kind: 'pdf' | 'html' | 'md' | 'json' | 'jsonresume') => {
      if (!data) return;
      const base = data.profile.name || '简历';
      if (kind === 'pdf') {
        printResume();
        showToast('在弹出的打印窗口里选「另存为 PDF」');
        return;
      }
      if (kind === 'html') {
        downloadFile(safeFileName(base, 'html'), toStandaloneHtml(data), 'text/html');
      } else if (kind === 'md') {
        downloadFile(safeFileName(base, 'md'), toMarkdown(data), 'text/markdown');
      } else if (kind === 'json') {
        downloadFile(safeFileName(base, 'json'), JSON.stringify(data, null, 2), 'application/json');
      } else {
        downloadFile(safeFileName(`${base}_jsonresume`, 'json'), JSON.stringify(toJsonResume(data), null, 2), 'application/json');
      }
      showToast('已导出文件');
    },
    [data, showToast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveDocs(docs);
        showToast('已保存到本机浏览器');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docs, showToast]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">RF</span>
          <span className="brand-text">
            <strong>简历工坊</strong>
            <em>ResumeForge</em>
          </span>
        </div>

        <div className="doc-switch">
          <IconFile size={15} />
          <select
            value={activeDoc?.id ?? ''}
            onChange={(e) => setActiveId(e.target.value)}
            aria-label="切换简历"
          >
            {docs.length === 0 && <option value="">暂无简历</option>}
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {docLabel(d)}
              </option>
            ))}
          </select>
        </div>

        <div className="topbar-actions">
          <button className="btn ghost" onClick={newDoc} title="新建空白简历">
            <IconPlus size={15} /> 新建
          </button>

          <details className="menu">
            <summary className="btn ghost">
              <IconDownload size={15} /> 导出
            </summary>
            <div className="menu-panel">
              <button onClick={() => exportAs('pdf')}>
                <strong>PDF</strong>
                <span>浏览器打印 → 另存为 PDF</span>
              </button>
              <button onClick={() => exportAs('html')}>
                <strong>HTML</strong>
                <span>单文件，样式内联，可直接分享</span>
              </button>
              <button onClick={() => exportAs('md')}>
                <strong>Markdown</strong>
                <span>贴进博客、Notion 或 README</span>
              </button>
              <button onClick={() => exportAs('json')}>
                <strong>JSON（本工具）</strong>
                <span>存档 / 跨设备迁移</span>
              </button>
              <button onClick={() => exportAs('jsonresume')}>
                <strong>JSON Resume</strong>
                <span>jsonresume.org 标准格式</span>
              </button>
            </div>
          </details>

          <button className="btn ghost" onClick={() => exportAs('pdf')} title="打印 / 导出 PDF">
            <IconPrinter size={15} /> 打印
          </button>

          <button
            className="btn ghost icon-only"
            onClick={() => setUi({ ...ui, theme: ui.theme === 'light' ? 'dark' : 'light' })}
            title="切换主题"
          >
            {ui.theme === 'light' ? '◐' : '◑'}
          </button>

          <button className="btn" onClick={() => setSettingsOpen(true)} title="AI 与偏好设置">
            <IconSettings size={15} /> 设置
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail">
          <label
            className={`dropzone ${busy ? 'is-busy' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
            <span className="dropzone-icon">PDF</span>
            <strong>{busy ?? '拖入 PDF 或点击上传'}</strong>
            <small>解析全在本地浏览器完成，不会上传服务器</small>
          </label>

          <div className="rail-section">
            <div className="rail-title">
              我的简历 <span>{docs.length}</span>
            </div>
            <ul className="doc-list">
              {docs.map((d) => (
                <li key={d.id} className={d.id === activeDoc?.id ? 'active' : ''}>
                  <button className="doc-item" onClick={() => setActiveId(d.id)}>
                    <strong>{docLabel(d)}</strong>
                    <small>
                      {new Date(d.updatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </small>
                  </button>
                  {docs.length > 1 && (
                    <button
                      className="doc-del"
                      onClick={() => removeDoc(d.id)}
                      title="删除这份简历"
                      aria-label="删除"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
              {docs.length === 0 && <li className="empty">还没有简历，上传 PDF 或新建一份</li>}
            </ul>
          </div>

          {meta?.report && (
            <div className="rail-section report">
              <div className="rail-title">解析报告</div>
              <div className="confidence">
                <div className="confidence-bar">
                  <span style={{ width: `${meta.report.confidence}%` }} />
                </div>
                <span className="confidence-num">{meta.report.confidence}%</span>
              </div>
              <div className="stat-grid">
                <div>
                  <b>{meta.report.stats.lines}</b>
                  <span>文本行</span>
                </div>
                <div>
                  <b>{meta.report.stats.headings}</b>
                  <span>章节</span>
                </div>
                <div>
                  <b>{meta.report.stats.entries}</b>
                  <span>条目</span>
                </div>
                <div>
                  <b>{meta.report.stats.bullets}</b>
                  <span>要点</span>
                </div>
              </div>
              {meta.report.warnings.map((w) => (
                <p className="warning" key={w}>
                  {w}
                </p>
              ))}
              {meta.report.leftovers.length > 0 && (
                <details className="leftovers">
                  <summary>有 {meta.report.leftovers.length} 行没归入章节</summary>
                  <ul>
                    {meta.report.leftovers.map((l, i) => (
                      <li key={`${l}-${i}`}>{l}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="rail-foot">
            <button className="link" onClick={useSample}>
              载入示例数据
            </button>
            <span>·</span>
            <span>Ctrl / ⌘ + S 保存</span>
          </div>
        </aside>

        <main className={`pane edit-pane ${mobileView === 'edit' ? 'mobile-active' : ''}`}>
          {data ? (
            <EditorPane
              data={data}
              onChange={updateData}
              ai={ai}
              onToast={showToast}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : (
            <div className="empty-state">
              <h2>先来一份简历</h2>
              <p>上传 PDF 自动解析，或从空白 / 示例开始。</p>
              <div className="row">
                <button className="btn" onClick={newDoc}>
                  <IconPlus size={15} /> 新建空白
                </button>
                <button className="btn ghost" onClick={useSample}>
                  载入示例
                </button>
              </div>
            </div>
          )}
        </main>

        <aside className={`pane stage-pane ${mobileView === 'preview' ? 'mobile-active' : ''}`}>
          {data ? (
            <PreviewPane
              data={data}
              ui={ui}
              onUiChange={setUi}
              onMetaChange={(patch) => updateData({ ...data, meta: { ...data.meta, ...patch } })}
              onExport={exportAs}
              thumbs={meta?.source?.thumbs ?? []}
              sourceName={meta?.source?.fileName ?? ''}
              scorePanel={<ScorePane data={data} jd={jd} onJdChange={setJd} />}
              stylePanel={<StylePane data={data} onChange={updateData} />}
            />
          ) : (
            <div className="empty-state">
              <h2>右侧实时预览</h2>
              <p>编辑左边任意字段，这里会立刻按 A4 排版更新。</p>
            </div>
          )}
        </aside>
      </div>

      <div className="mobile-switch">
        <button className={mobileView === 'edit' ? 'on' : ''} onClick={() => setMobileView('edit')}>
          编辑
        </button>
        <button
          className={mobileView === 'preview' ? 'on' : ''}
          onClick={() => setMobileView('preview')}
        >
          预览
        </button>
      </div>

      {settingsOpen && (
        <SettingsModal
          ai={ai}
          ui={ui}
          onSaveAi={setAi}
          onSaveUi={setUi}
          onClose={() => setSettingsOpen(false)}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind}`} key={toast.id}>
          {toast.kind === 'ok' ? <IconCheck size={15} /> : <span className="bang">!</span>}
          {toast.text}
        </div>
      )}

      {busy && (
        <div className="busy-overlay">
          <div className="busy-card">
            <div className="spinner" />
            <span>{busy}</span>
          </div>
        </div>
      )}
    </div>
  );
}

