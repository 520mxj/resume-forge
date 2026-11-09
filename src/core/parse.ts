import type { PdfExtraction, RawLine } from './pdf';
import { matchHeading, normalizeHeading, CANONICAL_TITLES } from './keywords';
import { uid } from './id';
import type { Entry, ParseReport, Profile, ResumeData, Section, SectionKind } from './types';

const CITY_HINT =
  /(北京|上海|广州|深圳|杭州|成都|南京|武汉|西安|苏州|重庆|天津|长沙|合肥|厦门|青岛|郑州|济南|大连|宁波|无锡|福州|东莞|佛山|珠海|香港|台北|新加坡|London|New York|Tokyo|Remote|远程)/i;
const ORG_HINT =
  /(公司|集团|有限|科技|银行|证券|工作室|实验室|研究院|研究所|大学|学院|学校|中学|医院|事务所|中心|事业部|分公司|Inc\.?|Ltd\.?|LLC|Corp\.?|Technolog|Studio|Group)/i;
const ORG_CHUNK =
  /([^\s，,|｜·]{2,}?(?:有限责任公司|股份有限公司|有限公司|公司|集团|银行|工作室|事务所|研究院|研究所|实验室|学院|大学|学校|中心|事业部|分公司))/;
const SCHOOL_HINT = /(大学|学院|学校|中学|研究院|University|College|School|Institute)/i;
const SCHOOL_CHUNK = /([^\s，,|｜·]{2,}?(?:职业技术学院|职业学院|技术学院|大学|学院|学校|中学))/;
const DEGREE_HINT = /(本科|硕士|博士|专科|大专|学士|研究生|高中|中专|MBA|EMBA|Ph\.?D|Bachelor|Master|Doctor|Associate)/i;
const DATE_TOKEN = '(?:19|20)\\d{2}';
const MONTH = '(?:1[0-2]|0?[1-9])';
const DATE_RANGE_RE = new RegExp(
  `(${DATE_TOKEN}\\s*[.\\-/年]?\\s*${MONTH}?\\s*月?)\\s*(?:[-–—~～至到]|to)\\s*(至今|现在|今|present|now|${DATE_TOKEN}\\s*[.\\-/年]?\\s*${MONTH}?\\s*月?)`,
  'i',
);
const SINGLE_DATE_RE = new RegExp(`(${DATE_TOKEN}\\s*[.\\-/年]\\s*${MONTH}\\s*月?)`, 'i');
const BULLET_RE =
  /^[\u2022\u00b7\u25cf\u25cb\u25aa\u25a0\u25c6\u25c7\u2013\u2014*+\-•]\s*|^\d{1,2}[.、)）]\s*/;
const TERMINAL_PUNCT = /[。；;！!？?]$/;

interface DateHit {
  raw: string;
  start: string;
  end: string;
  index: number;
  length: number;
}

function normalizeDateToken(token: string): string {
  const t = token.trim();
  if (/^(至今|现在|今|present|now)$/i.test(t)) return '至今';
  const m = t.match(new RegExp(`(${DATE_TOKEN})\\s*[.\\-/年]?\\s*(${MONTH})?`));
  if (!m) return t;
  return m[2] ? `${m[1]}.${m[2].padStart(2, '0')}` : m[1];
}

function findDate(text: string): DateHit | null {
  const range = DATE_RANGE_RE.exec(text);
  if (range) {
    return {
      raw: range[0],
      start: normalizeDateToken(range[1]),
      end: normalizeDateToken(range[2]),
      index: range.index,
      length: range[0].length,
    };
  }
  const single = SINGLE_DATE_RE.exec(text);
  if (single) {
    return {
      raw: single[0],
      start: normalizeDateToken(single[1]),
      end: '',
      index: single.index,
      length: single[0].length,
    };
  }
  return null;
}

function median(nums: number[]): number {
  if (!nums.length) return 10;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function splitParts(text: string): string[] {
  return text
    .split(/\s*[|｜]\s*|\s*·\s*|\s{2,}|\t+|\s+[–—]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanTitle(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')
    .replace(/^[\s:：、,，.。\-–—|]+|[\s:：、,，.。|]+$/g, '')
    .trim();
}

function stripBullet(text: string): string {
  return text.replace(BULLET_RE, '').trim();
}

function joinSmart(texts: string[]): string {
  let out = '';
  for (const raw of texts) {
    const text = raw.trim();
    if (!text) continue;
    if (!out) {
      out = text;
      continue;
    }
    const prev = out[out.length - 1];
    const next = text[0];
    const prevCjk = /[\u4e00-\u9fa5]/.test(prev);
    const nextCjk = /[\u4e00-\u9fa5]/.test(next);
    // 上一行写满了才认为是折行，否则当独立段落
    const wrapped = out.length - out.lastIndexOf('\n') > 28 && !/[\n。；;]$/.test(out);
    if (wrapped) out += prevCjk && nextCjk ? text : ` ${text}`;
    else out += `\n${text}`;
  }
  return out;
}

/** 把条目头的「公司 | 职位 | 城市」拆到对应字段 */
function fillEntryHeader(entry: Entry, rawText: string, kind: SectionKind): void {
  const text = cleanTitle(rawText);
  const parts = splitParts(text);
  const locationPart =
    parts.length > 1
      ? parts.find((p) => CITY_HINT.test(p) && p.length <= 24 && !ORG_HINT.test(p))
      : undefined;
  if (locationPart) entry.location = cleanTitle(locationPart);
  const rest = parts.filter((p) => p !== locationPart);

  if (kind === 'education') {
    const schoolChunk = text.match(SCHOOL_CHUNK);
    const school = schoolChunk ? cleanTitle(schoolChunk[1]) : rest.find((p) => SCHOOL_HINT.test(p));
    const remainder = schoolChunk ? cleanTitle(text.replace(schoolChunk[1], ' ')) : cleanTitle(rest.filter((p) => p !== school).join(' '));
    const degree = remainder.match(DEGREE_HINT)?.[0] ?? '';
    const major = cleanTitle(degree ? remainder.replace(degree, ' ') : remainder);
    entry.title = cleanTitle(school ?? rest[0] ?? text);
    entry.subtitle = cleanTitle([degree, major].filter(Boolean).join(' · '));
    return;
  }

  if (kind === 'skills' || kind === 'languages') {
    entry.title = cleanTitle(rest[0] ?? text);
    entry.subtitle = cleanTitle(rest.slice(1).join(' · '));
    return;
  }

  // 公司名和职位常挤在同一段：「广州某某科技有限公司 软件开发工程师」
  const orgChunk = text.match(ORG_CHUNK);
  if (orgChunk && orgChunk[1]) {
    const org = cleanTitle(orgChunk[1]);
    const remainder = cleanTitle(text.replace(orgChunk[1], ' '));
    entry.subtitle = org;
    entry.title = remainder;
    return;
  }

  if (rest.length > 1) {
    entry.title = cleanTitle(rest[0]);
    entry.subtitle = cleanTitle(rest.slice(1).join(' · '));
    return;
  }

  // 项目类常见「名称 角色」
  const spaced = text.split(/\s+/);
  if (spaced.length >= 2 && spaced[0].length <= 24) {
    entry.title = cleanTitle(spaced[0]);
    entry.subtitle = cleanTitle(spaced.slice(1).join(' '));
    return;
  }
  entry.title = text;
}

function newEntry(): Entry {
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

function parseTimelineSection(kind: SectionKind, title: string, lines: RawLine[]): Section {
  const section: Section = { id: uid('s'), kind, title, visible: true, entries: [], text: '' };
  let current: Entry | null = null;
  let lastBulletX: number | null = null;
  let prevLine: RawLine | null = null;
  let awaitingTitle = false;

  const pushBullet = (entry: Entry, text: string, x: number) => {
    const last = entry.bullets[entry.bullets.length - 1];
    // 上一行写满且没句号 → 认为折行，接到同一条
    const startsLabel = /^[^:：]{1,12}[:：]/.test(text);
    const wrapped =
      last &&
      !startsLabel &&
      last.text.length >= 28 &&
      !TERMINAL_PUNCT.test(last.text) &&
      Math.abs(x - (lastBulletX ?? x)) <= 24;
    if (wrapped && last) last.text = joinInline(last.text, text);
    else entry.bullets.push({ id: uid('b'), text });
    lastBulletX = x;
  };

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    const date = findDate(text);
    const looksBullet = BULLET_RE.test(text);

    if (date && !looksBullet) {
      const before = cleanTitle(text.slice(0, date.index));
      const after = cleanTitle(text.slice(date.index + date.length));
      let headerText = [before, after].filter(Boolean).join(' ');
      // 日期单独一行时，上一行短文本就是条目标题
      if (!headerText && prevLine) {
        const prevText = cleanTitle(prevLine.text);
        if (prevText.length <= 40 && !findDate(prevText)) {
          headerText = prevText;
          if (current && current.bullets.length) {
            const last = current.bullets[current.bullets.length - 1];
            if (last.text === prevText) current.bullets.pop();
          }
        }
      }
      const entry = newEntry();
      entry.start = date.start;
      entry.end = date.end;
      if (headerText) fillEntryHeader(entry, headerText, kind);
      section.entries.push(entry);
      current = entry;
      lastBulletX = null;
      awaitingTitle = !entry.title;
      prevLine = line;
      continue;
    }

    if (!current) {
      const entry = newEntry();
      fillEntryHeader(entry, text, kind);
      section.entries.push(entry);
      current = entry;
      lastBulletX = null;
      prevLine = line;
      continue;
    }

    // 公司+时间写在上一行、职位写在下一行的简历很常见
    if (awaitingTitle && !looksBullet && text.length <= 32) {
      current.title = cleanTitle(text);
      awaitingTitle = false;
      prevLine = line;
      continue;
    }
    awaitingTitle = false;
    pushBullet(current, stripBullet(text), line.x);
    prevLine = line;
  }

  // 只有一个「条目」且标题等于章节名时，说明这段其实是整段文字，不是时间轴
  return section;
}

function joinInline(a: string, b: string): string {
  const prev = a[a.length - 1];
  const next = b[0];
  const bothCjk = /[\u4e00-\u9fa5]/.test(prev) && /[\u4e00-\u9fa5]/.test(next);
  return bothCjk ? `${a}${b}` : `${a} ${b}`;
}

function parseTextSection(kind: SectionKind, title: string, lines: RawLine[]): Section {
  const text = joinSmart(lines.map((l) => l.text));
  return { id: uid('s'), kind, title, visible: true, entries: [], text };
}

const TAG_SPLIT = /[,，、/;；|]/;

/** 技能栏：按「标签：内容」分组；短行各自成条，只有明显折行才接上一条 */
function parseSkillsSection(title: string, lines: RawLine[]): Section {
  const groups: { label: string; text: string }[] = [];
  for (const line of lines) {
    const text = line.text.trim().replace(/^[\u00b7•·]\s*/, '');
    if (!text || /^[\u00b7•·\-–—_.、。:：|/\\]+$/.test(text)) continue;
    const m = text.match(/^([^:：]{1,14})[:：]\s*(.+)$/);
    if (m) {
      groups.push({ label: cleanTitle(m[1]), text: m[2].trim() });
      continue;
    }
    const last = groups[groups.length - 1];
    const continued = Boolean(last) && last.text.length >= 30 && !TERMINAL_PUNCT.test(last.text);
    if (continued && last) last.text = joinInline(last.text, text);
    else groups.push({ label: '', text });
  }

  const entries: Entry[] = groups.map((g) => {
    const entry = newEntry();
    entry.title = g.label;
    const items = g.text
      .split(TAG_SPLIT)
      .map((t) => t.trim())
      .filter(Boolean);
    const shortItems = items.length >= 2 && items.every((t) => t.length <= 16);
    if (shortItems) entry.tags = items;
    else if (g.label) entry.subtitle = g.text.trim();
    else entry.title = g.text.trim();
    return entry;
  });

  const cleaned = entries.filter(
    (e) => (e.title && !/^[\u00b7•·\-–—_.、。:：|/\\]+$/.test(e.title)) || e.tags.length || e.subtitle,
  );
  return { id: uid('s'), kind: 'skills', title, visible: true, entries: cleaned, text: '' };
}

/** 证书/荣誉：一行里用 · 或空白分隔的多条，拆成多个条目 */
function parseListSection(kind: SectionKind, title: string, lines: RawLine[]): Section {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const push = (entry: Entry) => {
    const key = entry.title.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    const normalized = text.replace(/^[\u00b7•·]\s*/, '');
    let items = normalized
      .split(/\s*[·•]\s*|\s{2,}/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (items.length < 2) {
      const tokens = normalized.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2 && tokens.every((t) => t.length <= 12 && !/[:：]/.test(t))) items = tokens;
    }
    if (items.length >= 2 && items.every((t) => t.length <= 24)) {
      for (const item of items) {
        const entry = newEntry();
        const date = findDate(item);
        entry.title = cleanTitle(date ? item.replace(date.raw, '') : item);
        if (date) {
          entry.start = date.start;
          entry.end = date.end;
        }
        push(entry);
      }
    } else {
      const entry = newEntry();
      const date = findDate(text);
      entry.title = cleanTitle(date ? text.replace(date.raw, '') : text);
      if (date) {
        entry.start = date.start;
        entry.end = date.end;
      }
      push(entry);
    }
  }
  return { id: uid('s'), kind, title, visible: true, entries, text: '' };
}

function parseProfile(headerLines: RawLine[], allText: string[]): Profile {
  const profile: Profile = {
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
  };

  const bodySize = median(headerLines.filter((l) => l.text.length >= 2).map((l) => l.size));
  const candidates = headerLines.filter((l) => l.text.trim().length > 0 && l.text.trim().length < 48);
  const nameLine = [...candidates].sort((a, b) => b.size - a.size)[0] ?? candidates[0] ?? null;

  if (nameLine) {
    let name = nameLine.text
      .replace(/个人简历|简历|求职简历|RESUME|CURRICULUM VITAE|CV/gi, '')
      .replace(/[\s|｜·—–-]+$/g, '')
      .trim();
    const emailInLine = name.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailInLine) name = name.slice(0, name.indexOf(emailInLine[0])).trim();
    const phoneInLine = name.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/);
    if (phoneInLine) name = name.slice(0, name.indexOf(phoneInLine[0])).trim();
    profile.name = name.slice(0, 32).trim();
  }

  for (const line of headerLines) {
    if (line === nameLine) continue;
    const text = line.text.trim();
    if (!text) continue;
    if (line.size > bodySize * 1.25 && !profile.headline && text.length <= 40) {
      profile.headline = text;
      continue;
    }
    const extra = text.match(
      /^(微信|电话|邮箱|Email|E-?mail|GitHub|Blog|博客|作品集|网站|LinkedIn|地址|现居|籍贯|求职意向|期望薪资|期望城市)[:：]\s*(.+)$/i,
    );
    if (extra) {
      profile.extras.push({ id: uid('x'), label: extra[1], value: extra[2].trim() });
    }
  }

  if (!profile.headline) {
    const candidate = headerLines.find(
      (l) =>
        l !== nameLine &&
        l.text.length >= 4 &&
        l.text.length <= 40 &&
        l.size >= bodySize * 0.98 &&
        l.size < (nameLine?.size ?? 99) * 0.8 &&
        !/[\w.+-]+@[\w-]+\.[\w.]+|1[3-9]\d{9}/.test(l.text) &&
        !/[:：]/.test(l.text),
    );
    if (candidate) profile.headline = candidate.text.trim();
  }

  const haystack = allText.join('\n');
  const email = haystack.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) profile.email = email[0];

  const phoneCn = haystack.match(/(?:\+?86[-\s]?)?(1[3-9]\d)[-\s]?(\d{4})[-\s]?(\d{4})/);
  const phoneIntl = haystack.match(/(?:\+\d{1,3}[-\s]?)?(?:\(\d{2,4}\)[-\s]?)?\d{3,4}[-\s]\d{3,4}[-\s]\d{2,4}/);
  if (phoneCn) profile.phone = phoneCn[0].replace(/\s+/g, ' ').trim();
  else if (phoneIntl && phoneIntl[0].replace(/\D/g, '').length >= 9) profile.phone = phoneIntl[0].trim();

  const github = haystack.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+/i);
  if (github) profile.github = github[0].replace(/^https?:\/\//, '');
  const linkedin = haystack.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w./-]+/i);
  if (linkedin) profile.linkedin = linkedin[0].replace(/^https?:\/\//, '');
  const site = haystack.match(/https?:\/\/[\w.-]+\.[a-z]{2,}(?:\/[\w./-]*)?/i);
  if (site && !/github\.com|linkedin\.com|mailto:/i.test(site[0])) profile.website = site[0];

  if (!profile.location) {
    const locLine = headerLines.map((l) => l.text).find((t) => CITY_HINT.test(t) && t.length <= 48);
    if (locLine) {
      const hit = locLine.match(CITY_HINT);
      if (hit) profile.location = hit[0];
    }
  }

  profile.extras = profile.extras.filter(
    (x) => !profile.email.includes(x.value) && !profile.phone.includes(x.value),
  );

  return profile;
}

function buildWarnings(lines: number, hasEmailOrPhone: boolean, sections: Section[], pages: number): string[] {
  const warnings: string[] = [];
  if (lines === 0) {
    warnings.push('这份 PDF 没有可提取的文字层，大概率是扫描件或图片导出，需要 OCR 后再解析。');
    return warnings;
  }
  if (!hasEmailOrPhone) warnings.push('没在文中找到邮箱或手机号，请手动补上基本信息。');
  if (!sections.length) warnings.push('没识别到标准章节标题，已把全文归入「个人简介」，建议手动拆分。');
  if (pages > 2) warnings.push(`文档共 ${pages} 页，解析按页顺序拼接，跨页的经历可能需要手工合并。`);
  return warnings;
}

export interface ParseOutput {
  data: ResumeData;
  report: ParseReport;
}

export function parseResume(ext: PdfExtraction): ParseOutput {
  const lines = ext.lines.filter((l) => l.text.trim().length > 0);
  const bodySize = median(lines.filter((l) => l.text.length >= 6).map((l) => l.size));

  const blocks: { kind: SectionKind | 'header'; title: string; lines: RawLine[] }[] = [
    { kind: 'header', title: '页眉', lines: [] },
  ];

  for (const line of lines) {
    const text = line.text.trim();
    const kind = matchHeading(text);
    const clean = cleanTitle(text);
    const exact = kind !== null && normalizeHeading(text).length <= 16;
    const tooBig = clean.length > 26;
    const endsSentence = TERMINAL_PUNCT.test(clean);
    const looksList = BULLET_RE.test(clean);
    const headingLevelOk = exact || line.bold || line.size > bodySize * 1.12;

    if (kind && !tooBig && !endsSentence && !looksList && headingLevelOk) {
      const last = blocks[blocks.length - 1];
      if (last.kind === kind) continue;
      blocks.push({ kind, title: CANONICAL_TITLES[kind], lines: [] });
      continue;
    }
    blocks[blocks.length - 1].lines.push(line);
  }

  const headerLines = blocks[0].lines;
  const allText = lines.map((l) => l.text);
  const profile = parseProfile(headerLines, allText);

  const sections: Section[] = [];
  const leftovers: string[] = [];
  for (const block of blocks.slice(1)) {
    if (!block.lines.length) continue;
    const kind = block.kind as SectionKind;
    let section: Section;
    if (kind === 'summary') section = parseTextSection(kind, block.title, block.lines);
    else if (kind === 'skills') section = parseSkillsSection(block.title, block.lines);
    else if (kind === 'certificates' || kind === 'awards' || kind === 'languages')
      section = parseListSection(kind, block.title, block.lines);
    else section = parseTimelineSection(kind, block.title, block.lines);

    const existing = sections.find((s) => s.kind === kind && kind !== 'custom');
    if (existing) existing.entries.push(...section.entries);
    else sections.push(section);
  }

  headerLines.slice(0, 6).forEach((l) => {
    const t = l.text.trim();
    if (
      t &&
      t.length > 2 &&
      !profile.name.includes(t) &&
      !profile.headline.includes(t) &&
      !profile.email.includes(t) &&
      !profile.phone.includes(t) &&
      !profile.extras.some((x) => x.value.includes(t))
    ) {
      leftovers.push(t);
    }
  });

  const entryCount = sections.reduce((n, s) => n + s.entries.length, 0);
  const bulletCount = sections.reduce((n, s) => n + s.entries.reduce((m, e) => m + e.bullets.length, 0), 0);

  let confidence = 40;
  if (profile.email || profile.phone) confidence += 8;
  if (profile.name) confidence += 8;
  if (sections.length >= 2) confidence += 10;
  else if (sections.length === 1) confidence += 4;
  confidence += Math.min(18, bulletCount * 2);
  confidence += Math.min(8, entryCount);
  if (bulletCount === 0 && entryCount > 0) confidence -= 12;
  if (leftovers.length > 3) confidence -= 5;
  if (lines.length < 12) confidence -= 10;
  confidence = Math.max(5, Math.min(94, confidence));

  const data: ResumeData = {
    schema: 'resume-forge/v1',
    profile,
    sections: sections.length
      ? sections
      : [
          {
            id: uid('s'),
            kind: 'summary',
            title: '个人简介',
            visible: true,
            entries: [],
            text: joinSmart(lines.map((l) => l.text)),
          },
        ],
    meta: {
      template: 'classic',
      accent: '#c2412d',
      fontScale: 1,
      lineHeight: 1.5,
      pageMargin: 18,
      showPhoto: false,
      uppercaseHeadings: false,
    },
  };

  const report: ParseReport = {
    confidence,
    stats: {
      lines: lines.length,
      headings: sections.length,
      entries: entryCount,
      bullets: bulletCount,
    },
    warnings: buildWarnings(lines.length, Boolean(profile.email || profile.phone), sections, ext.pages),
    leftovers: leftovers.slice(0, 12),
  };

  return { data, report };
}
