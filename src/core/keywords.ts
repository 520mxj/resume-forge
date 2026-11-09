import type { SectionKind } from './types';

/** 去掉空白、标点、括号注释，用于章节标题匹配 */
export function normalizeHeading(raw: string): string {
  return raw
    .replace(/[（(【\[][^)）】\]]*[)）】\]]/g, '')
    .toLowerCase()
    .replace(/[\s:：·•.。,，;；|/\\\-–—_=~"'“”‘’<>《》]/g, '')
    .trim();
}

export const CANONICAL_TITLES: Record<SectionKind, string> = {
  summary: '个人简介',
  experience: '工作经历',
  education: '教育背景',
  projects: '项目经历',
  skills: '专业技能',
  certificates: '证书资质',
  awards: '荣誉奖项',
  languages: '语言能力',
  custom: '其他',
};

const ALIASES: Record<SectionKind, string[]> = {
  summary: [
    '自我评价', '个人简介', '个人总结', '个人优势', '核心优势', '我的优势', '优势', '自我介绍',
    '关于我', '简介', '概述', '个人亮点',
    '求职意向', '个人陈述', '职业概述', '个人概况', 'summary', 'profile', 'aboutme',
    'objective', 'professional summary', 'introduction', 'overview',
  ],
  experience: [
    '工作经历', '工作经验', '职业经历', '工作履历', '职业履历', '任职经历', '实习经历',
    '实习经验', '从业经历', '工作经验及项目', '相关经历', '实践经历', '社会实践',
    '校园经历', '社团经历', '工作与实习', 'experience', 'work experience',
    'professional experience', 'employment', 'employment history', 'career',
    'work history', 'internship', 'internships', 'experience highlights',
  ],
  education: [
    '教育背景', '教育经历', '教育', '学历', '学习经历', '培训经历', '教育及培训',
    'education', 'academic background', 'academic', 'education & training',
    'educational background', 'training',
  ],
  projects: [
    '项目经历', '项目经验', '项目', '个人项目', '开源项目', '主要项目', '项目实践',
    '作品集', 'projects', 'project experience', 'personal projects', 'open source',
    'open source projects', 'project highlights', 'portfolio',
  ],
  skills: [
    '专业技能', '技能', '技能特长', '技术栈', '技术技能', '核心能力', '专业能力',
    '能力特长', '计算机能力', '计算机技能', 'it技能', '编程能力', '语言及技能',
    'skills', 'technical skills', 'technologies', 'expertise', 'competencies',
    'core skills', 'skill set', 'tools', 'tech stack',
  ],
  certificates: [
    '证书', '资格证书', '认证', '资质证书', '专业证书', '职业资格', '证书资质',
    'certifications', 'certificates', 'licenses', 'certification', 'credentials',
  ],
  awards: [
    '获奖', '获奖经历', '荣誉', '荣誉奖项', '奖项', '所获奖励', '奖学金', '奖励',
    'awards', 'honors', 'honours', 'achievements', 'awards & honors',
  ],
  languages: [
    '语言能力', '语言', '外语能力', '外语', '语言水平', 'languages',
    'language skills', 'language',
  ],
  custom: [
    '兴趣爱好', '个人爱好', '特长', '发表论文', '论文', '研究成果', '专利', '出版物',
    '志愿经历', '志愿服务', '其他信息', '附加信息', 'interests', 'hobbies',
    'publications', 'papers', 'volunteer', 'additional information', 'misc',
  ],
};

interface AliasHit {
  alias: string;
  kind: SectionKind;
}

const ALIAS_TABLE: AliasHit[] = Object.entries(ALIASES)
  .flatMap(([kind, list]) => list.map((alias) => ({ alias: normalizeHeading(alias), kind: kind as SectionKind })))
  .filter((x) => x.alias.length > 0)
  .sort((a, b) => b.alias.length - a.alias.length);

/** 命中的章节类型；返回 null 表示不是标题行 */
export function matchHeading(raw: string): SectionKind | null {
  const n = normalizeHeading(raw);
  if (!n || n.length > 32) return null;

  for (const hit of ALIAS_TABLE) {
    if (n === hit.alias) return hit.kind;
  }
  // 允许「工作经历 WORK EXPERIENCE」「一、教育背景」这类带前后缀的写法，
  // 但只认足够长的别名，避免 "it" / "ai" 之流误伤正文
  for (const hit of ALIAS_TABLE) {
    if (hit.alias.length >= 4 && n.includes(hit.alias) && n.length <= hit.alias.length + 12) {
      return hit.kind;
    }
  }
  return null;
}

/** 常见技能词表：既用于技能栏切分提示，也用于 JD 匹配 */
export const SKILL_TERMS = [
  'javascript', 'typescript', 'python', 'java', 'golang', 'go', 'rust', 'c++', 'c#', 'c语言',
  'php', 'ruby', 'kotlin', 'swift', 'scala', 'dart', 'lua', 'perl', 'shell', 'bash', 'powershell',
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'node.js', 'express', 'nestjs', 'koa',
  'spring', 'spring boot', 'django', 'flask', 'fastapi', 'laravel', 'gin', 'echo', 'fiber',
  'html', 'css', 'sass', 'less', 'tailwind', 'webpack', 'vite', 'rollup', 'babel', 'esbuild',
  'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'clickhouse', 'sqlite',
  'oracle', 'sql server', 'kafka', 'rabbitmq', 'rocketmq', 'nats', 'zookeeper', 'etcd',
  'docker', 'kubernetes', 'k8s', 'helm', 'istio', 'jenkins', 'gitlab ci', 'github actions',
  'terraform', 'ansible', 'prometheus', 'grafana', 'elk', 'loki', 'skywalking', 'sentry',
  'aws', 'azure', 'gcp', '阿里云', '腾讯云', '华为云', 'linux', 'unix', 'nginx', 'apache',
  'git', 'svn', 'jira', 'confluence', 'figma', 'sketch', 'photoshop', 'illustrator',
  'android', 'ios', 'flutter', 'react native', 'uniapp', '小程序', '微信小程序', 'webgl',
  'three.js', 'canvas', 'websocket', 'grpc', 'graphql', 'restful', 'rest api', 'openapi',
  'machine learning', 'deep learning', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas',
  'numpy', 'opencv', 'nlp', 'llm', 'rag', 'transformer', 'langchain', 'ollama', 'stable diffusion',
  'hadoop', 'spark', 'flink', 'hive', 'airflow', 'dbt', 'etl', 'data warehouse', 'olap',
  'devops', 'ci/cd', 'sre', 'a/b testing', 'seo', 'sem', 'axure', 'visio', 'xmind',
  'pmp', 'scrum', '敏捷开发', '项目管理', '需求分析', '用户研究', '数据分析', 'sql',
  'matlab', 'r语言', 'stata', 'spss', 'tableau', 'power bi', 'excel', 'ppt', 'word',
  '计算机二级', '软件设计师', '软考', 'cet-4', 'cet-6', '英语六级', '雅思', '托福',
];

export const STRONG_VERBS_ZH = [
  '主导', '负责', '设计', '搭建', '实现', '开发', '重构', '优化', '提升', '降低', '推进',
  '落地', '建设', '引入', '治理', '沉淀', '输岀', '输出', '支撑', '协作', '带领', '管理',
  '调研', '梳理', '制定', '交付', '维护', '迁移', '集成', '定位', '排查', '上线',
];

export const STRONG_VERBS_EN = [
  'led', 'built', 'designed', 'implemented', 'developed', 'refactored', 'optimized',
  'reduced', 'increased', 'improved', 'launched', 'delivered', 'migrated', 'automated',
  'architected', 'owned', 'drove', 'scaled', 'shipped', 'streamlined',
];

export const WEAK_OPENERS = ['负责了', '参与了', '协助', '帮忙', '跟进', '做了', '进行'];

export const STOPWORDS_EN = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'have', 'has', 'that',
  'this', 'from', 'they', 'their', 'can', 'all', 'any', 'not', 'but', 'job', 'role', 'work',
  'team', 'teams', 'company', 'years', 'year', 'plus', 'etc', 'and/or', 'ability', 'strong',
  'good', 'must', 'should', 'including', 'such', 'as', 'to', 'of', 'in', 'on', 'at', 'a',
  'an', 'is', 'be', 'we', 'it', 'or', 'by', 'be', 'more', 'than', 'other', 'new', 'also',
]);

export const STOPWORDS_ZH = new Set([
  '我们', '你们', '他们', '岗位', '职位', '职责', '要求', '工作', '经验', '能力', '熟悉',
  '熟练', '掌握', '了解', '具备', '相关', '优先', '以上', '以及', '并且', '负责', '参与',
  '能够', '良好', '较强', '一定', '公司', '团队', '专业', '学历', '本科', '以上学历',
]);
