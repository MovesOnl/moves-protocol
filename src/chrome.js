// Shared by every page: the contract slot copy behaviour and the measured header height.
import { isStated } from './lib/register.js';

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function initChrome(register) {
  const timers = new WeakMap();
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.ca[data-state="stated"]');
    if (!btn) return;
    // the record is the source of truth at click time, the attribute is only a mirror
    const rec = register.records.ca;
    if (!isStated(rec) || !rec.value) return;
    const ok = await copyText(rec.value);
    const label = btn.querySelector('.ca-label'), live = btn.querySelector('.sr');
    if (label) label.textContent = ok ? 'COPIED' : 'PRESS CTRL+C';
    if (live) live.textContent = ok ? 'Copied to clipboard' : 'Copy failed';
    btn.classList.toggle('is-copied', ok);
    clearTimeout(timers.get(btn));
    timers.set(btn, setTimeout(() => { btn.classList.remove('is-copied'); if (label) label.textContent = 'CA'; if (live) live.textContent = ''; }, 1600));
  });

  const wrap = document.getElementById('ca-slot');
  const sync = () => {
    const h = Math.ceil(wrap.getBoundingClientRect().bottom + 6);
    document.documentElement.style.setProperty('--top-h', h + 'px');
  };
  new ResizeObserver(sync).observe(wrap);
  sync();
}
