// Markup for every register-driven element. Pure string functions: the build uses
// them for the static page and the gates read the result back out of the HTML.
import { isStated, deriveHandle } from './register.js';
import { X_ICON, GITHUB_ICON, COPY_ICON } from './icons.js';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STATE_WORD = { absent: 'NOT STATED', unconfirmed: 'UNCONFIRMED' };

export function caSlot(rec, cls) {
  if (isStated(rec) && rec.value) {
    return (
      `<button type="button" class="ca ${cls}" data-record="ca" data-state="stated" data-copy="${esc(rec.value)}" aria-label="Click to copy CA" title="Click to copy">` +
      `<span class="ca-label">CA</span><span class="ca-value">${esc(rec.value)}</span>${COPY_ICON}` +
      `<span class="sr" aria-live="polite"></span></button>`
    );
  }
  const word = STATE_WORD[rec.state] || 'NOT STATED';
  return (
    `<div class="ca ${cls} is-inert" data-record="ca" data-state="${esc(rec.state)}" role="group" aria-label="CA slot: ${word.toLowerCase()}">` +
    `<span class="ca-label">CA</span><span class="ca-value">${word}</span></div>`
  );
}

const KINDS = {
  x: { label: 'X', icon: X_ICON },
  github: { label: 'GitHub', icon: GITHUB_ICON },
};

export function social(kind, rec, cls, iconCls) {
  const k = KINDS[kind];
  const handle = isStated(rec) && rec.url ? deriveHandle(kind, rec.url) : null;
  if (handle) {
    return (
      `<a class="${cls} social-${kind}" data-record="${kind}" data-state="stated" href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer" aria-label="${k.label} ${esc(handle)}" title="${k.label} · ${esc(handle)}">` +
      `<span class="${iconCls}">${k.icon}</span></a>`
    );
  }
  const word = (STATE_WORD[rec.state] || 'NOT STATED').toLowerCase();
  return (
    `<span class="${cls} social-${kind} is-inert" data-record="${kind}" data-state="${esc(rec.state)}" role="img" aria-label="${k.label}: ${word}" title="${k.label} · ${word}">` +
    `<span class="${iconCls}">${k.icon}</span></span>`
  );
}

export function dock(reg) {
  const r = reg.records;
  return `<li class="dock-x">${social('x', r.x, 'dock-link', 'dock-icon')}</li><li class="dock-github">${social('github', r.github, 'dock-link', 'dock-icon')}</li>`;
}

export function footSocials(reg) {
  const r = reg.records;
  return `<li>${social('x', r.x, 'social', 'social-icon')}</li><li>${social('github', r.github, 'social', 'social-icon')}</li>`;
}

export function chips(reg) {
  const r = reg.records;
  const rows = [
    ['chain', 'Chain', r.chain],
    ['ca', 'Contract', r.ca],
    ['x', 'X', r.x],
    ['github', 'GitHub', r.github],
  ];
  return rows
    .map(([id, label, rec]) => {
      const on = isStated(rec);
      return (
        `<li class="chip${on ? ' chip-on' : ''}" data-record="${id}" data-state="${esc(rec.state)}">` +
        `<span class="chip-dot" aria-hidden="true"></span>${label}<small>${esc(rec.state)}</small></li>`
      );
    })
    .join('');
}

// What ships to the browser: states and values only. Dates and source notes stay in src/register.json.
export function publicRegister(reg) {
  const records = {};
  for (const [id, rec] of Object.entries(reg.records)) {
    records[id] = { state: rec.state };
    if (rec.value != null) records[id].value = rec.value;
    if (rec.url != null) records[id].url = rec.url;
  }
  return { schema: reg.schema, records };
}

export function fillPlaceholders(html, reg) {
  const r = reg.records;
  return html
    .replace('<!--@ca-slot-->', caSlot(r.ca, 'ca-top'))
    .replace('<!--@ca-card-->', caSlot(r.ca, 'card-ca'))
    .replace('<!--@dock-->', dock(reg))
    .replace('<!--@foot-socials-->', footSocials(reg))
    .replace('<!--@chips-->', chips(reg))
    .replace('<!--@chain-->', esc(r.chain.value || 'Solana'))
    .replace('<!--@rpc-host-->', isStated(r.rpc) ? esc(new URL(r.rpc.url).host) : 'not stated')
    .replace('/*@register*/', JSON.stringify(publicRegister(reg)).replace(/</g, '\\u003c'));
}

