// Scroll choreography: sheet transitions, the sample board, the finale dot and the floor wipe.
import { scrollY, viewH, subscribe, smoothActive, docTop, offsetWithin, offsetLeftWithin, visTop, clamp01, smoothstep, backOut } from './lib/scroll.js';
import { CARD_ICONS } from './lib/icons.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- sample board data (shape only, no figures are shown) ---------- */
const CURVE = [[0, 80], [6, 77], [12, 81], [18, 78], [24, 80], [30, 77], [36, 79], [42, 76], [50, 78], [55, 70], [60, 61], [65, 52], [70, 44], [75, 36], [80, 28], [85, 21], [90, 27], [95, 23], [100, 25]]
  .map(([x, y]) => [x, 44 + (y - 21) * 0.8]);
const curveY = (x) => {
  for (let i = 1; i < CURVE.length; i++) {
    const a = CURVE[i - 1], b = CURVE[i];
    if (x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  }
  return CURVE[CURVE.length - 1][1];
};
const SLOT_X = [4, 27, 50, 73];
const CARD_BOTTOM = 34;
const START_X = 50;

function buildBoard(section) {
  const board = section.querySelector('.board');
  const svg = board.querySelector('.board-lines');
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  svg.append(mk('line', { class: 'board-start', x1: START_X, y1: CARD_BOTTOM + 4, x2: START_X, y2: 98 }));
  svg.append(mk('path', { class: 'board-price', d: CURVE.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '), 'data-at': 0, 'data-span': 0.16 }));
  const cards = [...section.querySelectorAll('.card')];
  cards.forEach((c) => {
    const slot = Number(c.dataset.slot);
    const mx = Number(c.dataset.mark);
    const at = Number(c.dataset.at);
    c.style.setProperty('--slot-x', SLOT_X[slot] + '%');
    const icon = c.querySelector('.card-icon');
    if (icon && CARD_ICONS[icon.dataset.icon]) icon.innerHTML = CARD_ICONS[icon.dataset.icon];
    const followed = c.classList.contains('followed');
    svg.append(mk('line', { class: followed ? 'board-link followed' : 'board-link', x1: SLOT_X[slot] + 10, y1: CARD_BOTTOM, x2: mx, y2: curveY(mx), 'data-at': (at + 0.05).toFixed(2), 'data-span': 0.05 }));
    const m = document.createElement('i');
    m.className = followed ? 'board-mark followed' : 'board-mark';
    m.dataset.at = (at + 0.08).toFixed(2); m.dataset.span = 0.04; m.dataset.x = mx; m.dataset.y = curveY(mx).toFixed(2);
    board.insertBefore(m, board.querySelector('.cards'));
  });
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * 100;
    const d = document.createElement('i');
    d.className = 'board-dot';
    d.dataset.at = ((i / 60) * 0.16).toFixed(3); d.dataset.span = 0.02; d.dataset.x = x.toFixed(2); d.dataset.y = curveY(x).toFixed(2);
    board.insertBefore(d, board.querySelector('.cards'));
  }
}

function dossier(section, board) {
  buildBoard(section);
  const noMotion = reduced();
  const narrow = window.matchMedia('(max-width: 860px)');
  const items = [...section.querySelectorAll('[data-at]')].map((el) => ({ el, at: Number(el.dataset.at), span: Number(el.dataset.span || 0.06), last: -1 }));
  const cards = [...section.querySelectorAll('.card')];
  section.querySelectorAll('[data-w]').forEach((e) => e.style.setProperty('--w', e.dataset.w));
  section.querySelectorAll('[data-x]').forEach((e) => { e.style.setProperty('--x', e.dataset.x); e.style.setProperty('--y', e.dataset.y); });
  let last = -1, top = 0, h = 1, bOff = 0, bH = 1;
  const measure = () => { top = docTop(section); h = section.offsetHeight; bOff = offsetWithin(board, section); bH = board.offsetHeight; };
  const tick = () => {
    const vh = viewH();
    const vt = visTop(top, h, scrollY(), vh);
    let p = 1;
    if (!noMotion) p = narrow.matches ? clamp01((vh * 0.9 - vt - bOff) / Math.max(1, bH + vh * 0.35)) : clamp01(-vt / Math.max(1, h - vh));
    if (Math.abs(p - last) < 0.0008) return;
    last = p;
    for (const it of items) {
      const r = Math.round(clamp01((p - it.at) / it.span) * 1000) / 1000;
      if (r !== it.last) {
        it.last = r;
        it.el.style.setProperty('--r', String(r));
        it.el.style.setProperty('--e', backOut(r).toFixed(3));
        if (it.el.dataset.toggle !== undefined) it.el.toggleAttribute('data-on', r > 0.5);
      }
    }
    for (const c of cards) if (noMotion || Number(c.style.getPropertyValue('--r') || 0) > 0.6) c.classList.add('is-played');
  };
  const remeasure = () => { measure(); last = -1; tick(); };
  measure(); tick();
  subscribe(tick);
  window.addEventListener('resize', remeasure);
  new ResizeObserver(remeasure).observe(section);
}

/* ---------- finale: full stop grows into the floor colour ---------- */
function finale(section, onProgress) {
  const pin = section.querySelector('.finale-pin');
  const dot = section.querySelector('.full-stop');
  const fill = section.querySelector('.finale-fill');
  const tag = section.querySelector('.tag');
  const words = [...section.querySelectorAll('.huge span')];
  const noMotion = reduced();
  const set = (el, k, v) => { if (el._c?.[k] !== v) { (el._c ||= {})[k] = v; el.style.setProperty(k, v); } };
  let top = 0, h = 1, w = 1, ph = 1, dx = 0, dy = 0, dr = 1;
  const measure = () => {
    top = docTop(section); h = section.offsetHeight; w = pin.clientWidth; ph = pin.clientHeight;
    dr = dot.offsetWidth / 2; dx = offsetLeftWithin(dot, pin) + dr; dy = offsetWithin(dot, pin) + dr;
  };
  const sm = (v, a, s) => smoothstep(clamp01((v - a) / s));
  const tick = () => {
    const vh = viewH();
    const p = noMotion ? 0 : clamp01(-visTop(top, h, scrollY(), vh) / Math.max(1, h - vh));
    set(tag, 'opacity', (1 - sm(p, 0.02, 0.1)).toFixed(3));
    const lift = [70, 45, 0];
    words.forEach((el, i) => {
      const a = sm(p, 0.04 + i * 0.06, 0.14);
      set(el, 'opacity', (1 - a).toFixed(3));
      set(el, 'transform', lift[i] ? `translateY(${(-lift[i] * a).toFixed(1)}px)` : 'none');
    });
    const g = clamp01((p - 0.4) / 0.48);
    let r = dr, cx = dx, cy = dy;
    if (g > 0 && g < 0.2) r = dr * (1 - 0.3 * smoothstep(g / 0.2));
    else if (g >= 0.2) {
      const d = (g - 0.2) / 0.8, grow = Math.pow(d, 2.4), s = smoothstep(d);
      r = dr * 0.7 + (Math.hypot(w, ph) - dr * 0.7) * grow;
      cx = dx + (w / 2 - dx) * s;
      cy = dy + (ph / 2 - dy) * s - Math.sin(Math.min(1, d * 1.6) * Math.PI) * dr * 2.5;
    }
    set(fill, 'clip-path', `circle(${r.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`);
  };
  const re = () => { measure(); tick(); };
  measure(); tick();
  subscribe(tick);
  new ResizeObserver(re).observe(pin);
  new ResizeObserver(re).observe(section);
  document.fonts.ready.then(re);
}

/* ---------- sheets and the floor wipe ---------- */
function sheets(wipe, floor, progressRef) {
  const noMotion = reduced();
  const chapters = [...document.querySelectorAll('.chapter')];
  const sh = chapters.map((c) => c.querySelector('.sheet'));
  const enter = chapters.map((c) => c.dataset.enter || 'rise');
  const leave = chapters.map((c) => c.dataset.leave || 'scale');
  const pin = wipe.querySelector('.pin');
  const seabed = floor.querySelector('.seabed');
  const ui = floor.querySelector('.floor-ui');
  const cache = new Map();
  const set = (el, key, prop, v) => {
    const k = key + ':' + prop;
    if (cache.get(k) === v) return;
    cache.set(k, v);
    if (prop.startsWith('--')) el.style.setProperty(prop, v); else el.style.setProperty(prop, v || null);
  };
  let tops = [], hs = [], wipeTop = 0, vw = 1;
  const measure = () => {
    vw = document.documentElement.clientWidth;
    chapters.forEach((c) => { c.style.top = Math.min(0, window.innerHeight - c.offsetHeight) + 'px'; });
    tops = chapters.map(docTop); hs = chapters.map((c) => c.offsetHeight); wipeTop = docTop(wipe);
  };
  const poly = (m, w, h) => {
    const pts = m <= 1 ? [[0, 0], [m, 0], [0, m]] : [[0, 0], [1, 0], [1, m - 1], [m - 1, 1], [0, 1]];
    return 'polygon(' + pts.map(([a, b]) => `${(a * w).toFixed(1)}px ${((1 - b) * h).toFixed(1)}px`).join(', ') + ')';
  };
  const tick = () => {
    const vh = viewH();
    const lenis = smoothActive();
    const sy = scrollY();
    const wipeY = wipeTop - sy;
    const topOf = (i) => (i < chapters.length ? visTop(tops[i] ?? 0, hs[i] ?? vh, sy, vh) : wipeY);
    chapters.forEach((c, i) => {
      const sheet = sh[i];
      if (!sheet) return;
      const leaveP = noMotion ? 0 : clamp01(1 - topOf(i + 1) / vh);
      const s = smoothstep(leaveP);
      const x = i === 0 ? 0 : topOf(i);
      const enterP = i === 0 || noMotion ? 1 : clamp01(1 - x / vh);
      const u = smoothstep(enterP);
      const kind = enter[i];
      const entering = kind !== 'rise' && enterP > 0 && enterP < 1;
      const ph = hs[i] ?? vh;
      let tf = '', origin = '', clip = '', fade = 0.5 * s;
      if (entering) {
        tf = lenis ? `translateY(${(-x).toFixed(1)}px)` : '';
        const extra = Math.max(0, ph - vh).toFixed(1);
        if (kind === 'eclipse') clip = lenis ? `circle(${(Math.pow(u, 1.15) * Math.hypot(vw, vh) * 0.52).toFixed(1)}px at 50% ${(vh / 2).toFixed(1)}px)` : `circle(${(u * Math.hypot(vw / 2, vh) * 1.04).toFixed(1)}px at 50% 0px)`;
        else if (kind === 'slice') clip = lenis ? poly(u * 2, vw, vh) : `polygon(0 ${((1 - u) * vh * 0.42).toFixed(1)}px, 100% 0, 100% 100%, 0 100%)`;
        else if (kind === 'split') {
          const inset = ((1 - u) * vw) / 2;
          clip = `inset(0 ${inset.toFixed(1)}px ${lenis ? extra : '0'}px ${inset.toFixed(1)}px round ${(36 * (1 - u)).toFixed(1)}px)`;
        }
      } else if (s > 0) {
        origin = `50% ${(Math.max(0, ph - vh) + vh * 0.5).toFixed(0)}px`;
        if (leave[i] === 'tilt') tf = `perspective(1600px) rotateX(${(16 * s).toFixed(2)}deg) scale(${(1 - 0.08 * s).toFixed(4)})`;
        else if (leave[i] === 'dive') { tf = `scale(${(1 + 0.16 * s).toFixed(4)})`; fade = 0.7 * s; }
        else tf = `scale(${(1 - 0.1 * s).toFixed(4)})`;
        clip = `inset(${Math.max(0, ph - vh).toFixed(1)}px 0 0 0 round ${(40 * s).toFixed(1)}px)`;
      } else if (enterP < 1) {
        const rad = 48 * Math.pow(1 - enterP, 0.7);
        clip = rad > 0.5 ? `inset(0 round ${rad.toFixed(1)}px ${rad.toFixed(1)}px 0 0)` : '';
      }
      set(c, 'c' + i, 'background', entering ? 'transparent' : '');
      set(sheet, 's' + i, 'transform', tf);
      set(sheet, 's' + i, 'transform-origin', origin);
      set(sheet, 's' + i, 'clip-path', clip);
      set(sheet, 's' + i, 'opacity', fade > 0 ? (1 - fade).toFixed(3) : '');
    });
    const arrive = noMotion ? 1 : clamp01(1 - wipeY / vh);
    set(pin, 'pin', 'transform', lenis && arrive > 0 && arrive < 1 ? `translateY(${(-wipeY).toFixed(1)}px)` : '');
    set(pin, 'pin', 'opacity', smoothstep(arrive).toFixed(3));
    const inside = noMotion ? 1 : clamp01(-wipeY / (vh * 0.9));
    const b = smoothstep(clamp01(inside / 0.8));
    if (seabed) set(seabed, 'ground', 'transform', `scale(${(1.18 - 0.18 * b).toFixed(4)})`);
    progressRef.current = clamp01((inside - 0.15) / 0.85);
    if (ui) set(ui, 'ui', '--ui', clamp01((inside - 0.7) / 0.3).toFixed(3));
  };
  const re = () => { measure(); tick(); };
  measure(); tick();
  subscribe(tick);
  window.addEventListener('resize', re);
  const ro = new ResizeObserver(re);
  chapters.forEach((c) => ro.observe(c));
  ro.observe(wipe);
}

export function initChoreo() {
  const progressRef = { current: 0 };
  const d = document.getElementById('c2');
  dossier(d, d.querySelector('.board'));
  finale(document.getElementById('c4'));
  const wipe = document.getElementById('check');
  sheets(wipe, wipe.querySelector('.floor'), progressRef);
  return { progressRef };
}
