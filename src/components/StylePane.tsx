import type { ResumeData, ResumeMeta } from '../core/types';
import { ACCENTS, TEMPLATES } from '../core/types';
import { IconPlus, IconTrash } from './Icons';

interface Props {
  data: ResumeData;
  onChange: (next: ResumeData) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider-field">
      <span className="field-label">
        {label}
        <b>
          {value}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function StylePane({ data, onChange }: Props) {
  const setMeta = (patch: Partial<ResumeMeta>) => onChange({ ...data, meta: { ...data.meta, ...patch } });

  return (
    <div className="style-pane">
      <section className="mini-card">
        <div className="mini-head">
          <h3>模板</h3>
          <span className="muted">切换即时生效</span>
        </div>
        <div className="tpl-cards">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className={`tpl-card ${data.meta.template === t.id ? 'on' : ''}`}
              onClick={() => setMeta({ template: t.id })}
            >
              <span className={`tpl-thumb ${t.id}`}>
                <i />
                <i />
                <i />
                <i />
              </span>
              <strong>{t.name}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="mini-card">
        <div className="mini-head">
          <h3>配色</h3>
          <span className="muted">强调色会用在标题、标签和分隔线上</span>
        </div>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              className={`swatch ${data.meta.accent.toLowerCase() === a.value.toLowerCase() ? 'on' : ''}`}
              style={{ background: a.value }}
              title={a.name}
              onClick={() => setMeta({ accent: a.value })}
            >
              {a.name}
            </button>
          ))}
          <label className="swatch custom" title="自定义颜色">
            <input
              type="color"
              value={data.meta.accent}
              onChange={(e) => setMeta({ accent: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="mini-card">
        <div className="mini-head">
          <h3>排版</h3>
          <span className="muted">导出前调到一页放得下</span>
        </div>
        <div className="sliders">
          <Slider
            label="字号"
            value={data.meta.fontScale}
            min={0.82}
            max={1.2}
            step={0.02}
            suffix="×"
            onChange={(v) => setMeta({ fontScale: v })}
          />
          <Slider
            label="行距"
            value={data.meta.lineHeight}
            min={1.25}
            max={1.9}
            step={0.05}
            onChange={(v) => setMeta({ lineHeight: v })}
          />
          <Slider
            label="页边距"
            value={data.meta.pageMargin}
            min={10}
            max={28}
            step={1}
            suffix="mm"
            onChange={(v) => setMeta({ pageMargin: v })}
          />
        </div>

        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={data.meta.showPhoto}
              onChange={(e) => setMeta({ showPhoto: e.target.checked })}
            />
            <span>显示照片</span>
          </label>
        </div>

        {data.meta.showPhoto && (
          <div className="photo-row">
            <input
              value={data.profile.photo}
              placeholder="照片地址（https:// 或 data:image/…）"
              onChange={(e) =>
                onChange({
                  ...data,
                  profile: { ...data.profile, photo: e.target.value },
                })
              }
            />
            <label className="btn tiny ghost">
              上传
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () =>
                    onChange({ ...data, profile: { ...data.profile, photo: String(reader.result) } });
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {data.profile.photo && (
              <button
                className="icon-btn danger"
                onClick={() => onChange({ ...data, profile: { ...data.profile, photo: '' } })}
                title="移除照片"
              >
                <IconTrash size={13} />
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mini-card">
        <div className="mini-head">
          <h3>重置</h3>
        </div>
        <button
          className="btn tiny ghost"
          onClick={() =>
            setMeta({
              template: 'classic',
              accent: '#c2412d',
              fontScale: 1,
              lineHeight: 1.55,
              pageMargin: 18,
              showPhoto: false,
            })
          }
        >
          <IconPlus size={12} /> 恢复默认排版
        </button>
      </section>
    </div>
  );
}
