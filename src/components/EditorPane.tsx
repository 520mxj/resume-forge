import { useMemo, useState } from 'react';
import type { AiSettings } from '../core/storage';
import type { Entry, ResumeData, Section, SectionKind } from '../core/types';
import { uid } from '../core/id';
import { CANONICAL_TITLES } from '../core/keywords';
import { hasAi, polishBullet, writeSummary } from '../core/ai';
import { IconGrip, IconPlus, IconSpark, IconTrash, IconEye, IconEyeOff } from './Icons';

interface Props {
  data: ResumeData;
  onChange: (next: ResumeData) => void;
  ai: AiSettings;
  onToast: (text: string, kind?: 'ok' | 'err') => void;
  onOpenSettings: () => void;
}

const KIND_OPTIONS: SectionKind[] = [
  'experience',
  'projects',
  'education',
  'skills',
  'certificates',
  'awards',
  'languages',
  'summary',
  'custom',
];

function emptyEntry(): Entry {
  return {
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
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  wide,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  wide?: boolean;
  hint?: string;
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const parts = draft
      .split(/[,，、;；]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...tags];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft('');
  };
  return (
    <div className="tag-input">
      <div className="chips">
        {tags.map((t) => (
          <span className="chip" key={t}>
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label="移除">
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          autoComplete="off"
          placeholder={tags.length ? '继续添加…' : '如 Python、Kubernetes'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={commit}
        />
      </div>
    </div>
  );
}

export default function EditorPane({ data, onChange, ai, onToast, onOpenSettings }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragSection, setDragSection] = useState<number | null>(null);
  const [dragEntry, setDragEntry] = useState<{ section: string; index: number } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const aiReady = hasAi(ai);

  const stats = useMemo(() => {
    const chars = data.sections
      .flatMap((s) => [s.text, ...s.entries.flatMap((e) => [e.title, e.subtitle, e.description, ...e.bullets.map((b) => b.text)])])
      .join('')
      .replace(/\s/g, '').length;
    return { chars, pages: Math.max(1, Math.ceil(chars / 1200)) };
  }, [data]);

  const patchProfile = (patch: Partial<ResumeData['profile']>) =>
    onChange({ ...data, profile: { ...data.profile, ...patch } });

  const patchSection = (sectionId: string, patch: Partial<Section>) =>
    onChange({
      ...data,
      sections: data.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    });

  const patchEntry = (sectionId: string, entryId: string, patch: Partial<Entry>) =>
    onChange({
      ...data,
      sections: data.sections.map((s) =>
        s.id === sectionId
          ? { ...s, entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }
          : s,
      ),
    });

  const addEntry = (sectionId: string) =>
    onChange({
      ...data,
      sections: data.sections.map((s) =>
        s.id === sectionId ? { ...s, entries: [...s.entries, emptyEntry()] } : s,
      ),
    });

  const removeEntry = (sectionId: string, entryId: string) =>
    onChange({
      ...data,
      sections: data.sections.map((s) =>
        s.id === sectionId ? { ...s, entries: s.entries.filter((e) => e.id !== entryId) } : s,
      ),
    });

  const addSection = (kind: SectionKind) => {
    const title = CANONICAL_TITLES[kind];
    const section: Section = {
      id: uid('s'),
      kind,
      title,
      visible: true,
      entries: kind === 'summary' ? [] : [emptyEntry()],
      text: '',
    };
    onChange({ ...data, sections: [...data.sections, section] });
  };

  const runSummaryAi = async () => {
    if (!aiReady) {
      onOpenSettings();
      onToast('先在设置里填上模型接口', 'err');
      return;
    }
    const section = data.sections.find((s) => s.kind === 'summary');
    if (!section) {
      onToast('先添加一个「个人简介」章节', 'err');
      return;
    }
    setBusyKey('summary');
    try {
      const text = await writeSummary(ai, data);
      patchSection(section.id, { text });
      onToast('已生成个人简介，记得核对事实');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '生成失败', 'err');
    } finally {
      setBusyKey(null);
    }
  };

  const runBulletAi = async (section: Section, entry: Entry, bulletId: string, text: string) => {
    if (!aiReady) {
      onOpenSettings();
      onToast('先在设置里填上模型接口', 'err');
      return;
    }
    setBusyKey(bulletId);
    try {
      const next = await polishBullet(ai, text, { role: entry.title, company: entry.subtitle });
      const clean = next.replace(/^[-•·*\s]+/, '').replace(/^["“]|["”]$/g, '').trim();
      patchEntry(section.id, entry.id, {
        bullets: entry.bullets.map((b) => (b.id === bulletId ? { ...b, text: clean } : b)),
      });
      onToast('已改写这一条');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '改写失败', 'err');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="editor">
      <div className="editor-scroll">
        <section className="card profile-card">
          <div className="card-head">
            <h2>基本信息</h2>
            <span className="muted">简历抬头，最先被看到的部分</span>
          </div>
          <div className="grid two">
            <Field label="姓名" value={data.profile.name} onChange={(v) => patchProfile({ name: v })} placeholder="张三" />
            <Field
              label="一句话定位"
              value={data.profile.headline}
              onChange={(v) => patchProfile({ headline: v })}
              placeholder="后端工程师 · 5 年分布式系统经验"
            />
            <Field label="手机" value={data.profile.phone} onChange={(v) => patchProfile({ phone: v })} placeholder="138 0000 0000" />
            <Field label="邮箱" value={data.profile.email} onChange={(v) => patchProfile({ email: v })} placeholder="you@example.com" />
            <Field label="城市" value={data.profile.location} onChange={(v) => patchProfile({ location: v })} placeholder="深圳" />
            <Field label="GitHub" value={data.profile.github} onChange={(v) => patchProfile({ github: v })} placeholder="github.com/you" />
            <Field label="个人网站" value={data.profile.website} onChange={(v) => patchProfile({ website: v })} placeholder="you.dev" />
            <Field label="LinkedIn" value={data.profile.linkedin} onChange={(v) => patchProfile({ linkedin: v })} placeholder="linkedin.com/in/you" />
          </div>

          <div className="extras">
            <div className="extras-head">
              <span className="field-label">附加联系方式</span>
              <button
                className="btn tiny ghost"
                onClick={() =>
                  onChange({
                    ...data,
                    profile: {
                      ...data.profile,
                      extras: [...data.profile.extras, { id: uid('x'), label: '微信', value: '' }],
                    },
                  })
                }
              >
                <IconPlus size={13} /> 添加
              </button>
            </div>
            {data.profile.extras.map((extra) => (
              <div className="extra-row" key={extra.id}>
                <input
                  className="extra-label"
                  autoComplete="off"
                  value={extra.label}
                  placeholder="标签"
                  onChange={(e) =>
                    patchProfile({
                      extras: data.profile.extras.map((x) => (x.id === extra.id ? { ...x, label: e.target.value } : x)),
                    })
                  }
                />
                <input
                  value={extra.value}
                  autoComplete="off"
                  placeholder="值"
                  onChange={(e) =>
                    patchProfile({
                      extras: data.profile.extras.map((x) => (x.id === extra.id ? { ...x, value: e.target.value } : x)),
                    })
                  }
                />
                <button
                  className="icon-btn"
                  onClick={() => patchProfile({ extras: data.profile.extras.filter((x) => x.id !== extra.id) })}
                  aria-label="删除"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="section-list">
          {data.sections.map((section, index) => (
            <section
              key={section.id}
              className={`card section-card ${section.visible ? '' : 'is-hidden'} ${
                dragSection === index ? 'dragging' : ''
              }`}
              onDragOver={(e) => {
                if (dragSection !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragSection !== null && dragSection !== index) {
                  onChange({ ...data, sections: move(data.sections, dragSection, index) });
                }
                setDragSection(null);
              }}
            >
              <div className="section-head">
                <button
                  className="grip"
                  draggable
                  onDragStart={() => setDragSection(index)}
                  onDragEnd={() => setDragSection(null)}
                  title="拖动调整章节顺序"
                  aria-label="拖动排序"
                >
                  <IconGrip size={14} />
                </button>
                <input
                  className="section-title"
                  value={section.title}
                  onChange={(e) => patchSection(section.id, { title: e.target.value })}
                  aria-label="章节标题"
                />
                <span className="badge">{section.entries.length}</span>
                <button
                  className="icon-btn"
                  onClick={() => patchSection(section.id, { visible: !section.visible })}
                  title={section.visible ? '在简历中隐藏' : '显示在简历中'}
                >
                  {section.visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() =>
                    onChange({ ...data, sections: data.sections.filter((s) => s.id !== section.id) })
                  }
                  title="删除章节"
                >
                  <IconTrash size={14} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))}
                  title={collapsed[section.id] ? '展开' : '收起'}
                >
                  {collapsed[section.id] ? '＋' : '－'}
                </button>
              </div>

              {!collapsed[section.id] && (
                <div className="section-body">
                  {section.kind === 'summary' && (
                    <div className="field wide">
                      <span className="field-label">正文</span>
                      <textarea
                        rows={4}
                        value={section.text}
                        placeholder="两三句话写清年限、方向和最硬的一个成果。"
                        onChange={(e) => patchSection(section.id, { text: e.target.value })}
                      />
                      <button className="btn tiny ghost ai" onClick={runSummaryAi} disabled={busyKey === 'summary'}>
                        <IconSpark size={13} />
                        {busyKey === 'summary' ? '生成中…' : '让 AI 起草'}
                      </button>
                    </div>
                  )}

                  {section.entries.map((entry, entryIndex) => (
                    <article
                      key={entry.id}
                      className={`entry ${dragEntry?.section === section.id && dragEntry.index === entryIndex ? 'dragging' : ''}`}
                      onDragOver={(e) => {
                        if (dragEntry && dragEntry.section === section.id) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragEntry && dragEntry.section === section.id && dragEntry.index !== entryIndex) {
                          patchSection(section.id, { entries: move(section.entries, dragEntry.index, entryIndex) });
                        }
                        setDragEntry(null);
                      }}
                    >
                      <div className="entry-head">
                        <button
                          className="grip small"
                          draggable
                          onDragStart={() => setDragEntry({ section: section.id, index: entryIndex })}
                          onDragEnd={() => setDragEntry(null)}
                          aria-label="拖动排序"
                        >
                          <IconGrip size={12} />
                        </button>
                        <span className="entry-index">{entryIndex + 1}</span>
                        <span className="entry-summary">
                          {entry.title || entry.tags.join(' / ') || '（空）'}
                          {entry.subtitle ? ` · ${entry.subtitle}` : ''}
                        </span>
                        <button className="icon-btn danger" onClick={() => removeEntry(section.id, entry.id)} title="删除这一条">
                          <IconTrash size={13} />
                        </button>
                      </div>

                      <div className="entry-body">
                        {section.kind === 'skills' || section.kind === 'languages' ? (
                          <>
                            <div className="grid two">
                              <Field
                                label="分类"
                                value={entry.title}
                                onChange={(v) => patchEntry(section.id, entry.id, { title: v })}
                                placeholder="语言 / 框架 / 工具"
                              />
                              <Field
                                label="补充说明"
                                value={entry.subtitle}
                                onChange={(v) => patchEntry(section.id, entry.id, { subtitle: v })}
                                placeholder="可选"
                              />
                            </div>
                            <div className="field wide">
                              <span className="field-label">标签</span>
                              <TagInput
                                tags={entry.tags}
                                onChange={(tags) => patchEntry(section.id, entry.id, { tags })}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid two">
                              <Field
                                label={section.kind === 'education' ? '学校' : '职位 / 名称'}
                                value={entry.title}
                                onChange={(v) => patchEntry(section.id, entry.id, { title: v })}
                                placeholder={section.kind === 'education' ? '南方理工大学' : '高级后端工程师'}
                              />
                              <Field
                                label={section.kind === 'education' ? '专业 · 学历' : '公司 / 组织'}
                                value={entry.subtitle}
                                onChange={(v) => patchEntry(section.id, entry.id, { subtitle: v })}
                                placeholder={section.kind === 'education' ? '计算机科学与技术 · 本科' : '星澜科技'}
                              />
                              <Field
                                label="开始"
                                value={entry.start}
                                onChange={(v) => patchEntry(section.id, entry.id, { start: v })}
                                placeholder="2022.04"
                              />
                              <Field
                                label="结束"
                                value={entry.end}
                                onChange={(v) => patchEntry(section.id, entry.id, { end: v })}
                                placeholder="至今"
                              />
                              <Field
                                label="地点"
                                value={entry.location}
                                onChange={(v) => patchEntry(section.id, entry.id, { location: v })}
                                placeholder="深圳"
                              />
                              <Field
                                label="链接"
                                value={entry.link}
                                onChange={(v) => patchEntry(section.id, entry.id, { link: v })}
                                placeholder="可选，作品或仓库地址"
                              />
                            </div>

                            <div className="bullets">
                              <div className="bullets-head">
                                <span className="field-label">要点</span>
                                <button
                                  className="btn tiny ghost"
                                  onClick={() =>
                                    patchEntry(section.id, entry.id, {
                                      bullets: [...entry.bullets, { id: uid('b'), text: '' }],
                                    })
                                  }
                                >
                                  <IconPlus size={12} /> 加一条
                                </button>
                              </div>
                              {entry.bullets.map((bullet, bi) => (
                                <div className="bullet-row" key={bullet.id}>
                                  <span className="bullet-dot" />
                                  <textarea
                                    rows={2}
                                    value={bullet.text}
                                    placeholder="动词开头 + 做了什么 + 结果（尽量带数字）"
                                    onChange={(e) =>
                                      patchEntry(section.id, entry.id, {
                                        bullets: entry.bullets.map((b) =>
                                          b.id === bullet.id ? { ...b, text: e.target.value } : b,
                                        ),
                                      })
                                    }
                                  />
                                  <div className="bullet-actions">
                                    <button
                                      className="icon-btn ai"
                                      title="用 AI 改写这一条"
                                      disabled={busyKey === bullet.id}
                                      onClick={() => runBulletAi(section, entry, bullet.id, bullet.text)}
                                    >
                                      <IconSpark size={13} />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      title="上移"
                                      disabled={bi === 0}
                                      onClick={() =>
                                        patchEntry(section.id, entry.id, { bullets: move(entry.bullets, bi, bi - 1) })
                                      }
                                    >
                                      ↑
                                    </button>
                                    <button
                                      className="icon-btn"
                                      title="下移"
                                      disabled={bi === entry.bullets.length - 1}
                                      onClick={() =>
                                        patchEntry(section.id, entry.id, { bullets: move(entry.bullets, bi, bi + 1) })
                                      }
                                    >
                                      ↓
                                    </button>
                                    <button
                                      className="icon-btn danger"
                                      title="删除"
                                      onClick={() =>
                                        patchEntry(section.id, entry.id, {
                                          bullets: entry.bullets.filter((b) => b.id !== bullet.id),
                                        })
                                      }
                                    >
                                      <IconTrash size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {entry.bullets.length === 0 && (
                                <textarea
                                  className="desc-area"
                                  rows={3}
                                  value={entry.description}
                                  placeholder="没有要点时，这里写整段描述也行。"
                                  onChange={(e) => patchEntry(section.id, entry.id, { description: e.target.value })}
                                />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </article>
                  ))}

                  {section.kind !== 'summary' && (
                    <button className="add-entry" onClick={() => addEntry(section.id)}>
                      <IconPlus size={14} /> 添加一条
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>

        <details className="add-section">
          <summary className="btn ghost wide">
            <IconPlus size={15} /> 添加章节
          </summary>
          <div className="add-section-grid">
            {KIND_OPTIONS.map((kind) => (
              <button key={kind} onClick={() => addSection(kind)}>
                {CANONICAL_TITLES[kind]}
              </button>
            ))}
          </div>
        </details>
      </div>

      <footer className="editor-foot">
        <span>正文约 {stats.chars} 字</span>
        <span>预计 {stats.pages} 页 A4</span>
        <span className={aiReady ? 'ok' : 'muted'}>
          {aiReady ? 'AI 已就绪' : 'AI 未配置（可选）'}
        </span>
      </footer>
    </div>
  );
}
