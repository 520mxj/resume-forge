import type { ResumeDoc, ResumeData } from './types';

const KEYS = {
  docs: 'resume-forge:docs:v1',
  active: 'resume-forge:active:v1',
  ai: 'resume-forge:ai:v1',
  ui: 'resume-forge:ui:v1',
} as const;

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface UiSettings {
  theme: 'light' | 'dark';
  zoom: number;
  zoomAuto: boolean;
  showSource: boolean;
  pane: 'edit' | 'score' | 'style';
}

export const DEFAULT_AI: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};

export const DEFAULT_UI: UiSettings = {
  theme: 'light',
  zoom: 0.86,
  zoomAuto: true,
  showSource: true,
  pane: 'edit',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadDocs(): ResumeDoc[] {
  const docs = read<ResumeDoc[]>(KEYS.docs, []);
  return Array.isArray(docs) ? docs.filter((d) => d && d.data && d.data.profile) : [];
}

export function saveDocs(docs: ResumeDoc[]): boolean {
  return write(KEYS.docs, docs);
}

export function loadActiveId(): string | null {
  return read<string | null>(KEYS.active, null);
}

export function saveActiveId(id: string | null) {
  write(KEYS.active, id);
}

export function loadAi(): AiSettings {
  return { ...DEFAULT_AI, ...read<Partial<AiSettings>>(KEYS.ai, {}) };
}

export function saveAi(settings: AiSettings) {
  write(KEYS.ai, settings);
}

export function loadUi(): UiSettings {
  return { ...DEFAULT_UI, ...read<Partial<UiSettings>>(KEYS.ui, {}) };
}

export function saveUi(settings: UiSettings) {
  write(KEYS.ui, settings);
}

export function makeDoc(name: string, data: ResumeData): ResumeDoc {
  return { id: `doc_${Math.random().toString(36).slice(2, 9)}`, name, updatedAt: Date.now(), data };
}

export function docLabel(doc: ResumeDoc): string {
  return doc.data.profile.name?.trim() || doc.name || '未命名简历';
}
