import { useMemo } from 'react';
import type { ResumeData } from '../core/types';
import { lintResume, matchResume } from '../core/score';
import { IconCheck, IconInfo, IconWarn } from './Icons';

interface Props {
  data: ResumeData;
  jd: string;
  onJdChange: (jd: string) => void;
}

function Ring({ value, label }: { value: number; label: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  const tone = value >= 75 ? 'good' : value >= 50 ? 'mid' : 'low';
  return (
    <div className={`ring ${tone}`}>
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={radius} className="ring-bg" />
        <circle
          cx="34"
          cy="34"
          r={radius}
          className="ring-fg"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
        />
      </svg>
      <div className="ring-text">
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function ScorePane({ data, jd, onJdChange }: Props) {
  const lint = useMemo(() => lintResume(data), [data]);
  const match = useMemo(() => (jd.trim().length > 24 ? matchResume(data, jd) : null), [data, jd]);

  const counts = useMemo(() => {
    const errors = lint.items.filter((i) => i.level === 'error').length;
    const warns = lint.items.filter((i) => i.level === 'warn').length;
    return { errors, warns };
  }, [lint.items]);

  return (
    <div className="score-pane">
      <section className="mini-card">
        <div className="mini-head">
          <h3>简历体检</h3>
          <span className="muted">
            {counts.errors ? `${counts.errors} 个严重` : '无严重问题'} · {counts.warns} 个建议
          </span>
        </div>
        <div className="lint-list">
          {lint.items.length === 0 && <p className="empty-hint">没发现问题，可以直接导出了。</p>}
          {lint.items.map((item, i) => (
            <div className={`lint-item ${item.level}`} key={`${item.title}-${i}`}>
              <span className="lint-icon">
                {item.level === 'error' ? (
                  <IconWarn size={14} />
                ) : item.level === 'warn' ? (
                  <IconInfo size={14} />
                ) : (
                  <IconCheck size={14} />
                )}
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mini-card">
        <div className="mini-head">
          <h3>岗位匹配度</h3>
          <span className="muted">粘贴 JD，本地计算关键词覆盖</span>
        </div>
        <textarea
          className="jd-input"
          rows={5}
          value={jd}
          placeholder="把目标岗位的职位描述粘进来，自动对比简历里的关键词覆盖情况。"
          onChange={(e) => onJdChange(e.target.value)}
        />
        {match ? (
          <div className="match-result">
            <Ring value={match.score} label="覆盖度" />
            <div className="match-detail">
              <p>
                命中 <b>{match.matched}</b> / {match.total} 个关键词
              </p>
              {match.missing.length > 0 ? (
                <>
                  <p className="muted">这些词 JD 提到但简历没写，确认属实后再补：</p>
                  <div className="chips">
                    {match.missing.map((k) => (
                      <span className="chip warn" key={k}>
                        {k}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="ok">主要关键词都覆盖到了。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="empty-hint">粘贴 25 个字以上的 JD 后自动计算，内容不会离开这台设备。</p>
        )}
      </section>
    </div>
  );
}
