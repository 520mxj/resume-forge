import type { ResumeData, Section } from './types';
import { SKILL_TERMS, STOPWORDS_EN, STRONG_VERBS_EN, STRONG_VERBS_ZH, WEAK_OPENERS } from './keywords';

export function resumePlainText(data: ResumeData): string {
  const parts: string[] = [
    data.profile.name,
    data.profile.headline,
    data.profile.location,
    data.profile.website,
    data.profile.github,
    data.profile.linkedin,
  ];
  for (const s of data.sections) {
    if (!s.visible) continue;
    parts.push(s.title, s.text);
    for (const e of s.entries) {
      parts.push(e.title, e.subtitle, e.location, e.link, e.description, ...e.tags);
      for (const b of e.bullets) parts.push(b.text);
    }
  }
  return parts.filter(Boolean).join('\n');
}

function compact(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

export interface KeywordHit {
  term: string;
  weight: number;
  inResume: boolean;
}

export interface MatchResult {
  score: number;
  matched: number;
  total: number;
  hits: KeywordHit[];
  missing: string[];
}

/** 从 JD 里抽关键词：英文按词频，技能词表命中额外加权 */
export function extractJdKeywords(jd: string): Map<string, number> {
  const weights = new Map<string, number>();
  const lower = jd.toLowerCase();

  for (const raw of lower.match(/[a-z][a-z0-9+#./-]{1,24}/g) ?? []) {
    const term = raw.replace(/[.·]+$/, '');
    if (term.length < 2 || STOPWORDS_EN.has(term)) continue;
    if (/^\d+$/.test(term)) continue;
    weights.set(term, (weights.get(term) ?? 0) + 1);
  }

  for (const term of SKILL_TERMS) {
    const t = term.toLowerCase();
    const isLatin = /^[a-z0-9+#./ -]+$/.test(t);
    const hit = isLatin
      ? new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(lower)
      : lower.includes(t);
    if (hit) weights.set(t, (weights.get(t) ?? 0) + 3);
  }

  // 权重 = 1 + log2(出现次数)，词表命中已经带 3 的底
  const scored = new Map<string, number>();
  for (const [term, count] of weights) {
    scored.set(term, 1 + Math.log2(count + 1));
  }
  return new Map([...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60));
}

export function matchResume(data: ResumeData, jd: string): MatchResult {
  const keywords = extractJdKeywords(jd);
  const resume = resumePlainText(data);
  const resumeLower = resume.toLowerCase();
  const resumeCompact = compact(resume);

  let matchedWeight = 0;
  let totalWeight = 0;
  const hits: KeywordHit[] = [];

  for (const [term, weight] of keywords) {
    const isLatin = /^[a-z0-9+#./ -]+$/.test(term);
    let found: boolean;
    if (isLatin) {
      found = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(
        resumeLower,
      );
    } else {
      found = resumeCompact.includes(compact(term));
    }
    totalWeight += weight;
    if (found) matchedWeight += weight;
    hits.push({ term, weight, inResume: found });
  }

  const score = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  const matched = hits.filter((h) => h.inResume).length;
  const missing = hits
    .filter((h) => !h.inResume && h.weight >= 1.6)
    .slice(0, 14)
    .map((h) => h.term);

  return { score, matched, total: hits.length, hits, missing };
}

export interface LintItem {
  level: 'error' | 'warn' | 'info';
  title: string;
  detail: string;
}

export interface LintResult {
  score: number;
  items: LintItem[];
}

function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

function startsWeak(text: string): boolean {
  const t = text.trim().toLowerCase();
  return WEAK_OPENERS.some((w) => t.startsWith(w));
}

function startsStrong(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    STRONG_VERBS_ZH.some((v) => t.startsWith(v)) ||
    STRONG_VERBS_EN.some((v) => t.startsWith(`${v} `) || t === v)
  );
}

function collectBullets(data: ResumeData): { section: Section; text: string }[] {
  const out: { section: Section; text: string }[] = [];
  for (const s of data.sections) {
    if (!s.visible) continue;
    for (const e of s.entries) for (const b of e.bullets) out.push({ section: s, text: b.text });
  }
  return out;
}

export function lintResume(data: ResumeData): LintResult {
  const items: LintItem[] = [];
  const bullets = collectBullets(data);
  const expSections = data.sections.filter((s) => s.visible && s.kind === 'experience');
  const expEntries = expSections.flatMap((s) => s.entries);

  if (!data.profile.name.trim()) {
    items.push({ level: 'error', title: '缺少姓名', detail: '姓名是简历最先被看到的信息，务必填写。' });
  }
  if (!data.profile.email.trim() && !data.profile.phone.trim()) {
    items.push({ level: 'error', title: '缺少联系方式', detail: '至少留一个邮箱或手机号，否则 HR 找不到你。' });
  } else if (!data.profile.email.trim()) {
    items.push({ level: 'warn', title: '没有邮箱', detail: '外企和线上投递更看重邮箱，建议补上。' });
  }

  const summary = data.sections.find((s) => s.kind === 'summary');
  const summaryText = summary ? (summary.text || summary.entries.map((e) => e.description).join('')) : '';
  if (!summaryText.trim()) {
    items.push({ level: 'info', title: '没有个人简介', detail: '2–3 句写清年限、方向和最强的一个成果，能明显提高初筛通过率。' });
  } else if (summaryText.trim().length < 40) {
    items.push({ level: 'info', title: '个人简介偏短', detail: '目前不到 40 字，可以再补一句量化成果。' });
  }

  if (bullets.length) {
    const withNumbers = bullets.filter((b) => hasNumber(b.text)).length;
    const ratio = withNumbers / bullets.length;
    if (ratio < 0.35) {
      items.push({
        level: 'warn',
        title: '量化成果偏少',
        detail: `${bullets.length} 条要点里只有 ${withNumbers} 条带数字。建议把「提升了性能」改写成「P99 从 480ms 降到 120ms」这类可验证表述。`,
      });
    }

    const longOnes = bullets.filter((b) => b.text.length > 120);
    if (longOnes.length) {
      items.push({
        level: 'warn',
        title: `${longOnes.length} 条要点过长`,
        detail: `超过 120 字的要点会让人抓不到重点，首条示例：${longOnes[0].text.slice(0, 46)}…`,
      });
    }

    const weak = bullets.filter((b) => startsWeak(b.text));
    if (weak.length) {
      items.push({
        level: 'info',
        title: `${weak.length} 条要点用了弱动词开头`,
        detail: `「负责了 / 参与了 / 协助」这类开头会弱化你的贡献，建议换成「主导 / 设计 / 落地」。示例：${weak[0].text.slice(0, 32)}…`,
      });
    }

    const strong = bullets.filter((b) => startsStrong(b.text)).length;
    if (strong === 0 && bullets.length >= 3) {
      items.push({ level: 'info', title: '要点缺少强动词开头', detail: '每条要点用动词开头（主导 / 设计 / 重构 / 降低），可读性会好很多。' });
    }

    const seen = new Map<string, number>();
    for (const b of bullets) seen.set(b.text.trim(), (seen.get(b.text.trim()) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, n]) => n > 1);
    if (dupes.length) {
      items.push({ level: 'warn', title: '存在重复要点', detail: `有 ${dupes.length} 条文本完全重复，检查是否粘贴重了。` });
    }
  } else if (expEntries.length) {
    items.push({ level: 'info', title: '经历里没有要点', detail: '每条经历写 2–4 条成果型要点，比整段描述更易读。' });
  }

  const missingDates = expEntries.filter((e) => !e.start.trim() && !e.end.trim());
  if (missingDates.length) {
    items.push({ level: 'warn', title: `${missingDates.length} 条经历缺时间`, detail: '时间线是 HR 判断稳定性的第一依据，缺失容易被当作隐瞒。' });
  }

  const dateStyles = new Set<string>();
  for (const e of [...expEntries, ...data.sections.flatMap((s) => (s.kind === 'education' ? s.entries : []))]) {
    if (!e.start) continue;
    if (/^\d{4}\.\d{2}$/.test(e.start)) dateStyles.add('dot');
    else if (/^\d{4}-\d{2}$/.test(e.start)) dateStyles.add('dash');
    else if (/年/.test(e.start)) dateStyles.add('cn');
    else dateStyles.add('other');
  }
  if (dateStyles.size > 1) {
    items.push({ level: 'info', title: '时间格式不统一', detail: '同一份简历里混用了多种日期写法，统一成 2021.03 这种最稳妥。' });
  }

  const skillTags = data.sections
    .filter((s) => s.visible && s.kind === 'skills')
    .flatMap((s) => s.entries.flatMap((e) => e.tags));
  if (!skillTags.length) {
    items.push({ level: 'warn', title: '没有技能标签', detail: 'ATS 常按关键词打分，技能栏缺失会直接影响匹配度。' });
  }

  const chars = resumePlainText(data).replace(/\s/g, '').length;
  if (chars > 2600) {
    items.push({ level: 'info', title: '篇幅可能超过两页', detail: `正文约 ${chars} 字，5 年以内经验建议压缩到 1–2 页。` });
  }

  const penalty = items.reduce((n, item) => n + (item.level === 'error' ? 22 : item.level === 'warn' ? 10 : 4), 0);
  return { score: Math.max(10, 100 - penalty), items };
}
