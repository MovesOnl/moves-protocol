// Live Solana readings, fetched straight from the browser. No proxy, no relay.
import { isStated } from './lib/register.js';

const fmt = (n) => Number(n).toLocaleString('en-US');

async function call(url, id, method, params) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  if (!res.ok) throw new Error('node ' + res.status);
  const body = await res.json();
  if (!body || body.result === undefined) throw new Error('node refused ' + method);
  return body.result;
}

async function read(url) {
  const [e, perf] = await Promise.all([call(url, 1, 'getEpochInfo', []), call(url, 2, 'getRecentPerformanceSamples', [1])]);
  const p = perf && perf[0];
  return { absoluteSlot: e.absoluteSlot, blockHeight: e.blockHeight, epoch: e.epoch, slotIndex: e.slotIndex, slotsInEpoch: e.slotsInEpoch, tps: p && p.samplePeriodSecs ? Math.round(p.numTransactions / p.samplePeriodSecs) : null };
}

export function startFeed(register) {
  const tiles = Object.fromEntries([...document.querySelectorAll('.stat')].map((el) => [el.dataset.stat, el]));
  const tag = document.getElementById('feed-tag');
  const live = document.getElementById('card-live');
  const rpc = register.records.rpc;
  const KEYS = ['slot', 'height', 'epoch', 'tps'];
  let seen = false, fails = 0, timer = 0, stopped = false;

  const paint = (key, text, state) => {
    const el = tiles[key];
    if (!el) return;
    const small = el.querySelector('[data-val]');
    const changed = small.textContent !== text;
    small.textContent = text;
    el.dataset.state = state;
    if (changed && state === 'live') { el.classList.remove('is-fresh'); void el.offsetWidth; el.classList.add('is-fresh'); }
  };
  const showLive = (d) => {
    seen = true;
    paint('slot', fmt(d.absoluteSlot), 'live');
    paint('height', fmt(d.blockHeight), 'live');
    paint('epoch', d.epoch + ' · ' + Math.floor((d.slotIndex / d.slotsInEpoch) * 100) + '%', 'live');
    paint('tps', d.tps == null ? 'n/a' : fmt(d.tps), d.tps == null ? 'unconfirmed' : 'live');
    if (tag) tag.textContent = 'READ LIVE FROM THE NODE';
    if (live) live.textContent = 'SOLANA · SLOT ' + fmt(d.absoluteSlot);
  };
  const showFail = () => {
    KEYS.forEach((k) => paint(k, seen ? 'STALE' : 'UNCONFIRMED', 'unconfirmed'));
    if (tag) tag.textContent = seen ? 'NODE UNREACHABLE · SHOWING LAST READING' : 'NODE UNREACHABLE · NO READING YET';
    if (live) live.textContent = 'ADDRESS CHECK · SOLANA';
  };

  async function poll(first) {
    if (stopped) return;
    if (document.hidden && !first) { timer = setTimeout(poll, 2000); return; }
    try { showLive(await read(rpc.url)); fails = 0; } catch { fails++; showFail(); }
    timer = setTimeout(poll, Math.min(60000, 8000 * Math.pow(2, Math.min(fails, 3))));
  }

  if (!isStated(rpc)) { showFail(); return () => {}; }
  poll(true);
  return () => { stopped = true; clearTimeout(timer); };
}
