/** 一份简历的全部数据。所有字段都可空，UI 会按空值隐藏。 */
export type SectionKind =
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certificates'
  | 'awards'
  | 'languages'
  | 'summary'
  | 'custom';

export interface Bullet {
  id: string;
  text: string;
}

export interface Entry {
  id: string;
  /** 职位 / 项目名 / 学校 / 证书名 */
  title: string;
  /** 公司 / 团队 / 专业 / 颁发机构 */
  subtitle: string;
  /** 开始时间，自由文本，解析器会尽量归一成 2021.03 这种 */
  start: string;
  end: string;
  location: string;
  link: string;
  /** 技能类条目的标签；其它类型一般不用 */
  tags: string[];
  /** 无 bullet 时的整段描述 */
  description: string;
  bullets: Bullet[];
}

export interface Section {
  id: string;
  kind: SectionKind;
  title: string;
  visible: boolean;
  entries: Entry[];
  /** summary 类章节的正文（entries 为空时使用） */
  text: string;
}

export interface Profile {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  github: string;
  linkedin: string;
  photo: string;
  /** 额外联系方式，例如「微信 / 博客 / 作品集」 */
  extras: { id: string; label: string; value: string }[];
}

export interface ResumeMeta {
  template: 'classic' | 'modern' | 'compact';
  accent: string;
  fontScale: number;
  lineHeight: number;
  pageMargin: number;
  showPhoto: boolean;
  uppercaseHeadings: boolean;
}

export interface ResumeData {
  schema: 'resume-forge/v1';
  profile: Profile;
  sections: Section[];
  meta: ResumeMeta;
}

export interface ResumeDoc {
  id: string;
  name: string;
  updatedAt: number;
  data: ResumeData;
}

/** 解析产物：结构 + 诊断信息 */
export interface ParseResult {
  data: ResumeData;
  report: ParseReport;
  source: {
    fileName: string;
    bytes: number;
    pages: number;
    thumbs: string[];
    lines: number;
  };
}

export interface ParseReport {
  /** 0-100，识别质量粗估 */
  confidence: number;
  stats: {
    lines: number;
    headings: number;
    entries: number;
    bullets: number;
  };
  warnings: string[];
  /** 未归入任何章节的原始行，供人工核对 */
  leftovers: string[];
}

export const ACCENTS = [
  { id: 'vermilion', name: '朱砂', value: '#c2412d' },
  { id: 'ink', name: '墨蓝', value: '#1f3a5f' },
  { id: 'forest', name: '松绿', value: '#2f5d50' },
  { id: 'plum', name: '绛紫', value: '#6b2d5c' },
  { id: 'graphite', name: '石墨', value: '#33363d' },
  { id: 'amber', name: '琥珀', value: '#a9621b' },
];

export const TEMPLATES: { id: ResumeMeta['template']; name: string; hint: string }[] = [
  { id: 'classic', name: '经典单栏', hint: '最稳妥，HR 和 ATS 都友好' },
  { id: 'modern', name: '现代侧栏', hint: '左侧信息栏 + 主内容，适合技术岗' },
  { id: 'compact', name: '紧凑排版', hint: '信息密度高，一页塞得下更多经历' },
];
