import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ResumeData, ResumeMeta } from '../core/types';
import { TEMPLATES } from '../core/types';
import type { UiSettings } from '../core/storage';
import { RESUME_CSS, renderResume } from '../core/template';
import { IconEye, IconPrinter } from './Icons';

interface Props {
  data: ResumeData;
  ui: UiSettings;
  onUiChange: (ui: UiSettings) => void;
  onMetaChange: (patch: Partial<ResumeMeta>) => void;
  onExport: (kind: 'pdf' | 'html' | 'md' | 'json' | 'jsonresume') => void;
  thumbs: string[];
  sourceName: string;
  scorePanel: ReactNode;
  stylePanel: ReactNode;
}

export default function PreviewPane({
  data,
  ui,
  onUiChange,
  onMetaChange,
  onExport,
  thumbs,
  sourceName,
  scorePanel,
  stylePanel,
}: Props) {
  const html = useMemo(() => renderResume(data), [data]);
  const [showSource, setShowSource] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 纸张比右栏宽时自动缩到刚好放下；用户手动缩放后不再自动改
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ui.zoomAuto) return;
    const fit = () => {
      const available = el.clientWidth - 40;
      const A4_WIDTH_PX = 793.7;
      const z = Math.max(0.42, Math.min(1.15, +(available / A4_WIDTH_PX).toFixed(3)));
      if (Math.abs(z - ui.zoom) > 0.006) onUiChange({ ...ui, zoom: z });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ui, onUiChange]);

  return (
    <div className="preview">
      <style dangerouslySetInnerHTML={{ __html: RESUME_CSS }} />
      <div className="preview-toolbar">
        <div className="tpl-switch">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className={data.meta.template === t.id ? 'on' : ''}
              title={t.hint}
              onClick={() => onMetaChange({ template: t.id })}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          {thumbs.length > 0 && (
            <button className="btn tiny ghost" onClick={() => setShowSource(true)} title={sourceName}>
              <IconEye size={13} /> 原稿
            </button>
          )}
          <div className="zoom">
            <button
              onClick={() => onUiChange({ ...ui, zoom: Math.max(0.4, +(ui.zoom - 0.08).toFixed(2)), zoomAuto: false })}
              aria-label="缩小"
            >
              −
            </button>
            <span>{Math.round(ui.zoom * 100)}%</span>
            <button
              onClick={() => onUiChange({ ...ui, zoom: Math.min(1.4, +(ui.zoom + 0.08).toFixed(2)), zoomAuto: false })}
              aria-label="放大"
            >
              +
            </button>
          </div>
          <button className="btn tiny" onClick={() => onExport('pdf')}>
            <IconPrinter size={13} /> 导出 PDF
          </button>
        </div>
      </div>

      <div className="preview-stage">
        <div className="preview-scroll" ref={scrollRef}>
          <div
            id="rf-print-area"
            className="sheet"
            style={{ zoom: ui.zoom }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      <div className="preview-panels">
        <div className="panel-tabs">
          <button
            className={ui.pane === 'score' ? 'on' : ''}
            onClick={() => onUiChange({ ...ui, pane: 'score' })}
          >
            体检 &amp; 匹配
          </button>
          <button
            className={ui.pane === 'style' ? 'on' : ''}
            onClick={() => onUiChange({ ...ui, pane: 'style' })}
          >
            样式
          </button>
        </div>
        <div className="panel-body">{ui.pane === 'score' ? scorePanel : stylePanel}</div>
      </div>

      {showSource && thumbs.length > 0 && (
        <div className="source-overlay" onClick={() => setShowSource(false)}>
          <div className="source-box" onClick={(e) => e.stopPropagation()}>
            <div className="source-head">
              <strong>原稿对照</strong>
              <span>{sourceName}</span>
              <button className="icon-btn" onClick={() => setShowSource(false)} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="source-pages">
              {thumbs.map((src, i) => (
                <img key={i} src={src} alt={`第 ${i + 1} 页`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
