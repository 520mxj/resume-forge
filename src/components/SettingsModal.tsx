import { useState } from 'react';
import type { AiSettings, UiSettings } from '../core/storage';
import { DEFAULT_AI } from '../core/storage';
import { testConnection } from '../core/ai';
import { IconCheck, IconWarn } from './Icons';

interface Props {
  ai: AiSettings;
  ui: UiSettings;
  onSaveAi: (ai: AiSettings) => void;
  onSaveUi: (ui: UiSettings) => void;
  onClose: () => void;
  onToast: (text: string, kind?: 'ok' | 'err') => void;
}

export default function SettingsModal({ ai, ui, onSaveAi, onSaveUi, onClose, onToast }: Props) {
  const [draft, setDraft] = useState<AiSettings>(ai);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    onSaveAi({ ...draft, baseUrl: draft.baseUrl.trim(), model: draft.model.trim() });
    onToast('设置已保存到本机');
    onClose();
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await testConnection(draft);
      setTestResult({ ok: true, text: reply.slice(0, 40) });
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : '连接失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="modal-body">
          <section className="modal-section">
            <h3>AI 改写（可选）</h3>
            <p className="muted">
              填写任意 OpenAI 兼容接口即可启用「AI 改写要点 / 起草简介」。Key 只存在你浏览器的
              localStorage，请求从本机直连你填的地址，不经过任何中转。
            </p>
            <div className="grid two">
              <label className="field wide2">
                <span className="field-label">接口地址</span>
                <input
                  value={draft.baseUrl}
                  placeholder="https://api.openai.com/v1"
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                />
                <span className="field-hint">兼容 DeepSeek / 通义 / Ollama：填到 /v1 为止</span>
              </label>
              <label className="field">
                <span className="field-label">模型</span>
                <input
                  value={draft.model}
                  placeholder="gpt-4o-mini"
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                />
              </label>
              <label className="field wide">
                <span className="field-label">API Key</span>
                <input
                  type="password"
                  value={draft.apiKey}
                  placeholder="sk-…"
                  autoComplete="off"
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                />
              </label>
            </div>
            <div className="row">
              <button className="btn ghost" onClick={runTest} disabled={testing || !draft.apiKey}>
                {testing ? '测试中…' : '测试连接'}
              </button>
              <button
                className="btn tiny ghost"
                onClick={() => setDraft({ ...DEFAULT_AI })}
                title="清空本地保存的 Key"
              >
                重置
              </button>
              {testResult && (
                <span className={`test-result ${testResult.ok ? 'ok' : 'err'}`}>
                  {testResult.ok ? <IconCheck size={13} /> : <IconWarn size={13} />}
                  {testResult.text}
                </span>
              )}
            </div>
          </section>

          <section className="modal-section">
            <h3>界面</h3>
            <div className="toggles">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={ui.theme === 'dark'}
                  onChange={(e) => onSaveUi({ ...ui, theme: e.target.checked ? 'dark' : 'light' })}
                />
                <span>暗色主题</span>
              </label>
            </div>
            <div className="slider-field">
              <span className="field-label">
                默认缩放 <b>{Math.round(ui.zoom * 100)}%</b>
              </span>
              <input
                type="range"
                min={0.5}
                max={1.2}
                step={0.02}
                value={ui.zoom}
                onChange={(e) => onSaveUi({ ...ui, zoom: Number(e.target.value) })}
              />
            </div>
          </section>

          <section className="modal-section about">
            <h3>关于</h3>
            <p>
              简历工坊 ResumeForge 是纯前端应用：PDF 解析、编辑、导出全在浏览器里完成，没有任何后端，
              简历内容不会离开本机。数据存在 localStorage，换浏览器/清缓存前记得导出 JSON 备份。
            </p>
          </section>
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn" onClick={save}>
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
