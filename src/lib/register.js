// Register of external facts. One record per fact, three states.
// Used by the build, the gates and the browser, so it stays DOM free.

export const STATES = ['stated', 'absent', 'unconfirmed'];
const LINK_KINDS = { x: ['x.com', 'twitter.com', 'www.x.com'], github: ['github.com', 'www.github.com'] };
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isStated(rec) {
  return !!rec && rec.state === 'stated';
}

export function isAddressShaped(s) {
  return typeof s === 'string' && s.length >= 32 && s.length <= 44 && BASE58.test(s);
}

// Handle is derived from the stored url, never stored itself.
export function deriveHandle(kind, url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !(LINK_KINDS[kind] || []).includes(u.hostname)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (!parts.length) return null;
  if (kind === 'x') return '@' + parts[0];
  return parts.slice(0, 2).join('/');
}

export function datedLabel(rec, fallback) {
  if (!rec) return fallback || '';
  if (rec.state === 'stated') return rec.statedAt || fallback || '';
  return rec.checkedAt || fallback || '';
}

export function validateRegister(reg) {
  const errors = [];
  const recs = reg && reg.records;
  if (!recs) return ['register has no records'];
  for (const id of ['name', 'domain', 'chain', 'rpc', 'ca', 'x', 'github']) {
    if (!recs[id]) errors.push(`missing record ${id}`);
  }
  for (const [id, r] of Object.entries(recs)) {
    if (!STATES.includes(r.state)) errors.push(`${id}: bad state ${r.state}`);
    if ('handle' in r) errors.push(`${id}: handle must be derived, not stored`);
    const hasPayload = r.value != null || r.url != null;
    if (r.state !== 'stated' && hasPayload) errors.push(`${id}: ${r.state} record carries a value or url`);
    if (r.state !== 'stated' && !r.checkedAt) errors.push(`${id}: ${r.state} record needs checkedAt`);
    if (r.state === 'stated') {
      // ca is written by setca with value and state only, so its statedAt and source may be null
      if (id !== 'ca' && !r.statedAt) errors.push(`${id}: stated record needs statedAt`);
      if (id !== 'ca' && !r.source) errors.push(`${id}: stated record needs source`);
      if (id === 'ca' && !r.value) errors.push('ca: stated record needs a value');
      if (id in LINK_KINDS) {
        if (!r.url || !deriveHandle(id, r.url)) errors.push(`${id}: stated url is not a valid ${id} profile url`);
      }
      if (id === 'ca' && !isAddressShaped(r.value)) errors.push('ca: stated value is not address-shaped');
      if (id === 'rpc' && !/^https:\/\//.test(r.url || '')) errors.push('rpc: stated url must be https');
    }
  }
  return errors;
}
