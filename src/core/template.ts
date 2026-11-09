import type { Entry, ResumeData, Section } from './types';

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESC[c]);
}

const SIDEBAR_KINDS = new Set<Section['kind']>(['skills', 'languages', 'certificates']);

function contactItems(data: ResumeData): string[] {
  const { profile } = data;
  const items: string[] = [];
  if (profile.phone) items.push(`<span class="rf-contact-item">${esc(profile.phone)}</span>`);
  if (profile.email)
    items.push(
      `<span class="rf-contact-item"><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></span>`,
    );
  if (profile.location) items.push(`<span class="rf-contact-item">${esc(profile.location)}</span>`);
  if (profile.github) items.push(`<span class="rf-contact-item">${esc(profile.github)}</span>`);
  if (profile.linkedin) items.push(`<span class="rf-contact-item">${esc(profile.linkedin)}</span>`);
  if (profile.website) items.push(`<span class="rf-contact-item">${esc(profile.website)}</span>`);
  for (const extra of profile.extras) {
    if (!extra.value) continue;
    items.push(
      `<span class="rf-contact-item"><em>${esc(extra.label)}</em> ${esc(extra.value)}</span>`,
    );
  }
  return items;
}

function renderBullets(entry: Entry): string {
  const bullets = entry.bullets.filter((b) => b.text.trim());
  if (bullets.length) {
    return `<ul class="rf-bullets">${bullets
      .map((b) => `<li>${esc(b.text.trim())}</li>`)
      .join('')}</ul>`;
  }
  if (entry.description.trim()) {
    return `<p class="rf-desc">${esc(entry.description.trim()).replace(/\n/g, '<br/>')}</p>`;
  }
  return '';
}

function dateLine(entry: Entry): string {
  const range = [entry.start, entry.end].filter(Boolean).join(' – ');
  const parts = [range, entry.location].filter(Boolean);
  if (!parts.length) return '';
  return `<div class="rf-meta">${parts.map((p) => `<span>${esc(p)}</span>`).join('<i>·</i>')}</div>`;
}

function renderEntry(entry: Entry, kind: Section['kind']): string {
  if (kind === 'skills' || kind === 'languages') {
    const tags = entry.tags.filter(Boolean);
    const label = entry.title ? `<div class="rf-skill-label">${esc(entry.title)}</div>` : '';
    if (tags.length) {
      return `<div class="rf-skill">${label}<div class="rf-tags">${tags
        .map((t) => `<span class="rf-tag">${esc(t)}</span>`)
        .join('')}</div></div>`;
    }
    if (entry.subtitle) {
      return `<div class="rf-skill">${label}<div class="rf-skill-text">${esc(entry.subtitle)}</div></div>`;
    }
    return `<div class="rf-skill"><div class="rf-skill-text">${esc(entry.title)}</div></div>`;
  }

  const title = entry.title.trim();
  const subtitle = entry.subtitle.trim();
  const head = `
    <div class="rf-entry-head">
      <div class="rf-entry-title">${title ? `<span class="rf-title">${esc(title)}</span>` : ''}${
        subtitle ? `<span class="rf-sub">${esc(subtitle)}</span>` : ''
      }</div>
      ${dateLine(entry)}
    </div>`;
  const link = entry.link.trim()
    ? `<div class="rf-link">${esc(entry.link.trim())}</div>`
    : '';
  return `<div class="rf-entry">${head}${link}${renderBullets(entry)}</div>`;
}

function renderSection(section: Section, data: ResumeData): string {
  const heading = `<h2 class="rf-h2">${esc(section.title)}${
    data.meta.uppercaseHeadings ? '' : ''
  }</h2>`;
  if (section.kind === 'summary' && !section.entries.length) {
    const text = section.text.trim();
    if (!text) return '';
    return `<section class="rf-sec rf-sec-summary">${heading}<p class="rf-summary">${esc(
      text,
    ).replace(/\n/g, '<br/>')}</p></section>`;
  }
  const entries = section.entries
    .filter((e) => e.title || e.subtitle || e.tags.length || e.description || e.bullets.length)
    .map((e) => renderEntry(e, section.kind))
    .join('');
  if (!entries) return '';
  return `<section class="rf-sec rf-sec-${section.kind}">${heading}<div class="rf-entries">${entries}</div></section>`;
}

export function renderResume(data: ResumeData): string {
  const { profile, meta } = data;
  const visible = data.sections.filter((s) => s.visible);
  const photo =
    meta.showPhoto && profile.photo
      ? `<img class="rf-photo" src="${esc(profile.photo)}" alt="" />`
      : '';
  const contacts = contactItems(data).join('');

  const style = [
    `--rf-accent:${meta.accent}`,
    `--rf-scale:${meta.fontScale}`,
    `--rf-lh:${meta.lineHeight}`,
    `--rf-pad:${meta.pageMargin}mm`,
  ].join(';');

  if (meta.template === 'modern') {
    const side = visible.filter((s) => SIDEBAR_KINDS.has(s.kind));
    const main = visible.filter((s) => !SIDEBAR_KINDS.has(s.kind));
    return `<div class="rf-page rf-modern" style="${style}">
      <aside class="rf-side">
        <div class="rf-side-head">
          ${photo}
          <div class="rf-name">${esc(profile.name || '你的名字')}</div>
          <div class="rf-headline">${esc(profile.headline)}</div>
        </div>
        <div class="rf-side-contact">${contacts.replace(/rf-contact-item/g, 'rf-side-item')}</div>
        ${side.map((s) => renderSection(s, data)).join('')}
      </aside>
      <main class="rf-main">${main.map((s) => renderSection(s, data)).join('')}</main>
    </div>`;
  }

  if (meta.template === 'compact') {
    return `<div class="rf-page rf-compact" style="${style}">
      <header class="rf-head">
        <div class="rf-head-row">
          <h1 class="rf-name">${esc(profile.name || '你的名字')}</h1>
          <div class="rf-contact-inline">${contacts}</div>
        </div>
        ${profile.headline ? `<div class="rf-headline">${esc(profile.headline)}</div>` : ''}
      </header>
      ${visible.map((s) => renderSection(s, data)).join('')}
    </div>`;
  }

  return `<div class="rf-page rf-classic" style="${style}">
    <header class="rf-head">
      ${photo}
      <h1 class="rf-name">${esc(profile.name || '你的名字')}</h1>
      ${profile.headline ? `<div class="rf-headline">${esc(profile.headline)}</div>` : ''}
      <div class="rf-contact">${contacts}</div>
    </header>
    ${visible.map((s) => renderSection(s, data)).join('')}
  </div>`;
}

export const RESUME_CSS = `
.rf-page {
  --rf-accent: #c2412d;
  --rf-scale: 1;
  --rf-lh: 1.5;
  --rf-pad: 18mm;
  box-sizing: border-box;
  width: 210mm;
  min-height: 297mm;
  padding: var(--rf-pad);
  background: #fff;
  color: #1b1b1f;
  font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: calc(10.2pt * var(--rf-scale));
  line-height: var(--rf-lh);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.rf-page * { box-sizing: border-box; }
.rf-page a { color: inherit; text-decoration: none; }

.rf-name { font-size: calc(23pt * var(--rf-scale)); line-height: 1.15; margin: 0; letter-spacing: 0.02em; font-weight: 700; }
.rf-headline { color: var(--rf-accent); font-size: calc(11pt * var(--rf-scale)); font-weight: 600; margin-top: 3pt; letter-spacing: 0.01em; }
.rf-head { margin-bottom: calc(10pt * var(--rf-scale)); }
.rf-photo { width: 22mm; height: 28mm; object-fit: cover; border-radius: 2mm; float: right; margin-left: 6mm; }

.rf-contact { display: flex; flex-wrap: wrap; gap: 2pt 12pt; margin-top: 6pt; color: #4a4a52; font-size: calc(9.4pt * var(--rf-scale)); }
.rf-contact-item em { font-style: normal; color: #8a8a93; margin-right: 2pt; }
.rf-contact-inline { display: flex; flex-wrap: wrap; gap: 2pt 10pt; color: #4a4a52; font-size: calc(9pt * var(--rf-scale)); justify-content: flex-end; max-width: 60%; }

.rf-h2 {
  font-size: calc(11.4pt * var(--rf-scale));
  font-weight: 700;
  color: var(--rf-accent);
  margin: calc(11pt * var(--rf-scale)) 0 calc(5pt * var(--rf-scale));
  padding-bottom: 2.5pt;
  border-bottom: 1px solid color-mix(in srgb, var(--rf-accent) 35%, transparent);
  letter-spacing: 0.08em;
}
.rf-sec:first-of-type .rf-h2 { margin-top: calc(6pt * var(--rf-scale)); }
.rf-entry { margin-bottom: calc(7pt * var(--rf-scale)); break-inside: avoid; }
.rf-entry-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8pt; }
.rf-entry-title { min-width: 0; }
.rf-title { font-weight: 700; font-size: calc(10.6pt * var(--rf-scale)); }
.rf-sub { color: #55555e; margin-left: 6pt; }
.rf-meta { color: #6b6b74; font-size: calc(9pt * var(--rf-scale)); white-space: nowrap; font-variant-numeric: tabular-nums; }
.rf-meta i { font-style: normal; margin: 0 4pt; color: #c3c3ca; }
.rf-link { color: var(--rf-accent); font-size: calc(8.8pt * var(--rf-scale)); word-break: break-all; }
.rf-bullets { margin: 3pt 0 0; padding-left: 13pt; }
.rf-bullets li { margin: 1.5pt 0; text-align: justify; }
.rf-bullets li::marker { color: var(--rf-accent); }
.rf-desc, .rf-summary { margin: 3pt 0 0; text-align: justify; }

.rf-skill { display: flex; gap: 8pt; margin-bottom: 3pt; break-inside: avoid; }
.rf-skill-label { min-width: 5.2em; font-weight: 600; color: #33333a; }
.rf-skill-text { color: #3d3d45; }
.rf-tags { display: flex; flex-wrap: wrap; gap: 3pt 5pt; }
.rf-tag {
  display: inline-block;
  padding: 0.5pt 5pt;
  border-radius: 3pt;
  background: color-mix(in srgb, var(--rf-accent) 9%, #fff);
  border: 0.4pt solid color-mix(in srgb, var(--rf-accent) 28%, #fff);
  font-size: calc(9pt * var(--rf-scale));
  line-height: 1.55;
}

/* 现代侧栏 */
.rf-modern { display: grid; grid-template-columns: 64mm 1fr; padding: 0; }
.rf-side { background: color-mix(in srgb, var(--rf-accent) 7%, #fff); padding: 14mm 8mm; border-right: 1px solid color-mix(in srgb, var(--rf-accent) 22%, #fff); }
.rf-main { padding: 14mm 9mm 14mm 8mm; min-width: 0; }
.rf-side-head { margin-bottom: 8pt; }
.rf-side .rf-name { font-size: calc(19pt * var(--rf-scale)); }
.rf-side .rf-h2 { font-size: calc(10pt * var(--rf-scale)); border-bottom: 1px solid color-mix(in srgb, var(--rf-accent) 30%, transparent); }
.rf-side .rf-tags { gap: 3pt; }
.rf-side .rf-tag { background: #fff; }
.rf-side-contact { display: flex; flex-direction: column; gap: 3pt; color: #4a4a52; font-size: calc(9pt * var(--rf-scale)); word-break: break-word; margin-bottom: 4pt; }
.rf-side-item em { font-style: normal; display: block; color: #8a8a93; font-size: calc(8.2pt * var(--rf-scale)); }

/* 紧凑版 */
.rf-compact .rf-head { border-bottom: 2px solid var(--rf-accent); padding-bottom: 5pt; }
.rf-compact .rf-name { font-size: calc(19pt * var(--rf-scale)); }
.rf-head-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 10pt; }
.rf-compact .rf-h2 { margin: calc(7pt * var(--rf-scale)) 0 3pt; border-bottom: none; border-left: 3pt solid var(--rf-accent); padding-left: 5pt; }
.rf-compact .rf-entry { margin-bottom: calc(5pt * var(--rf-scale)); }
`;
