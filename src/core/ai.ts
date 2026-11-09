import type { AiSettings } from './storage';
import type { ResumeData } from './types';

export function hasAi(settings: AiSettings): boolean {
  return Boolean(settings.apiKey.trim() && settings.baseUrl.trim() && settings.model.trim());
}

interface ChatOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export async function chat(settings: AiSettings, opts: ChatOptions): Promise<string> {
  const base = settings.baseUrl.replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 800,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`模型接口返回 ${res.status}：${text.slice(0, 200) || '无响应内容'}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('模型没有返回内容');
  return content;
}

const BULLET_SYSTEM = `你是资深简历改写顾问，服务对象是中文互联网/制造业的技术与运营岗位候选人。
你的任务：把一条简历要点改得更强，但绝不编造事实。
硬性规则：
1. 只能使用原文已有的事实、数字、技术名词；原文没有的数据不许凭空补。
2. 用「动词 + 对象 + 结果」的句式，动词开头，优先给出可量化结果。
3. 控制在 80 个汉字以内，单行，不加项目符号，不加引号。
4. 直接输出改写后的这一条要点，不要解释、不要前后缀、不要 markdown。`;

export async function polishBullet(
  settings: AiSettings,
  bullet: string,
  context: { role: string; company: string },
): Promise<string> {
  const user = `岗位：${context.role || '未填'}
公司/组织：${context.company || '未填'}
原始要点：${bullet}

请输出改写后的一条要点。`;
  return chat(settings, { system: BULLET_SYSTEM, user, temperature: 0.35, maxTokens: 300 });
}

const SUMMARY_SYSTEM = `你是简历顾问。请基于候选人已提供的真实信息，写一段 2–3 句的个人简介。
规则：
1. 只使用给出的信息，不虚构公司、年限、数字。
2. 第一句讲身份与年限，第二句讲最强的一项量化成果，第三句讲方向或优势。
3. 120–180 个汉字，直接输出正文，不要标题、不要解释、不要 markdown。`;

export async function writeSummary(
  settings: AiSettings,
  data: ResumeData,
  jd?: string,
): Promise<string> {
  const facts = data.sections
    .filter((s) => s.visible && s.kind !== 'summary')
    .map((s) => `${s.title}: ${s.entries.map((e) => `${e.title}@${e.subtitle} ${e.bullets.map((b) => b.text).join('；')}`).join(' / ')}`)
    .join('\n');
  const user = `姓名：${data.profile.name}
目标岗位：${data.profile.headline}
经历与成果：
${facts || '（暂无）'}
${jd ? `\n目标职位描述（用于对齐关键词，不要照抄句子）：\n${jd.slice(0, 1500)}` : ''}`;
  return chat(settings, { system: SUMMARY_SYSTEM, user, temperature: 0.5, maxTokens: 500 });
}

export async function testConnection(settings: AiSettings): Promise<string> {
  return chat(settings, {
    system: '你是一个连通性测试助手。',
    user: '只回复四个字：连接正常',
    temperature: 0,
    maxTokens: 20,
  });
}
