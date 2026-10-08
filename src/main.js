import './tokens.css';
import './styles.css';
import { classify } from './lib/gate.js';
import { initChrome } from './chrome.js';
import { attachSmooth, docTop, scrollToY, viewH, subscribe } from './lib/scroll.js';
import { initChoreo } from './choreo.js';
import { startFeed } from './feed.js';

const register = JSON.parse(document.getElementById('register').textContent);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;

initChrome(register);

/* ---------- address gate ---------- */
const form = document.getElementById('gate');
const input = document.getElementById('addr');
const out = document.getElementById('gate-out');
const run = () => {
  const r = classify(input.value, register);
  out.dataset.tone = r.tone;
  out.dataset.kind = r.kind;
  out.textContent = r.message;
};
form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
let debounce = 0;
input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(run, 140); });

/* ---------- smooth wheel (fine pointers only) ---------- */
if (!reduced && fine) {
  import('lenis').then(({ default: Lenis }) => {
    const lenis = new Lenis({ autoRaf: false, lerp: 0.12, smoothWheel: true, syncTouch: false, anchors: false });
    attachSmooth(lenis);
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }).catch(() => {});
}

/* ---------- chapters, board, floor ---------- */
const { progressRef } = initChoreo();

/* ---------- anchors ---------- */
function goto(id, animated) {
  const el = document.getElementById(id);
  if (!el) return;
  let top = docTop(el);
  if (id === 'check') top += viewH() * 0.9;
  scrollToY(top, animated && !reduced);
  if (animated && el.tabIndex === -1) el.focus({ preventScroll: true });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"], [data-goto]');
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const id = a.dataset.goto || a.getAttribute('href').slice(1);
  if (!id || !document.getElementById(id)) return;
  e.preventDefault();
  goto(id, true);
});
if (location.hash && document.getElementById(location.hash.slice(1))) {
  const id = location.hash.slice(1);
  document.fonts.ready.then(() => requestAnimationFrame(() => goto(id, false)));
}

/* ---------- live feed ---------- */
startFeed(register);

/* ---------- scenes, loaded when near ---------- */
const hero = document.getElementById('hero');
const mask = document.getElementById('c1');
const river = document.getElementById('c3');
const floor = document.querySelector('.floor');
const queue = [];
let busy = false;
const pump = async () => {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    await Promise.race([job(), new Promise((r) => setTimeout(r, 20000))]);
    await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 300)));
  }
  busy = false;
};
function lazy(el, near, loader, fail) {
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    queue.push(() => loader().catch(() => fail()));
    pump();
  };
  const io = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) { go(); io.disconnect(); } }, { rootMargin: `${near * 100}% 0px ${near * 100}% 0px` });
  io.observe(el);
  return go;
}
const noGl = (el) => () => el.classList.add('no-gl');
const [textCanvas, glCanvas] = hero.querySelectorAll('canvas.stage');
const LINES = ['MEMES MOVE.', 'EVIDENCE', 'SPEAKS.'];

// the flat headline paints immediately, the knot follows
const paintFlat = () => import('./scenes/util.js').then(({ drawHeadline }) => {
  const draw = () => drawHeadline(textCanvas, hero.clientWidth, hero.clientHeight, LINES);
  document.fonts.load('800 100px "Inter Variable"').then(() => { draw(); new ResizeObserver(draw).observe(hero); });
});
paintFlat();

const goHero = lazy(hero, 0.25, async () => {
  const { knotScene } = await import('./scenes/knot.js');
  const off = await knotScene({ hero, canvas: glCanvas, backdrop: textCanvas, lines: LINES });
  if (!off) { hero.classList.add('no-gl'); textCanvas.hidden = true; glCanvas.hidden = true; }
}, () => { hero.classList.add('no-gl'); textCanvas.hidden = true; glCanvas.hidden = true; });
const maskBox = mask.querySelector('.mask-pin');
lazy(mask, 0.4, async () => {
  const { maskScene } = await import('./scenes/mask.js');
  const off = await maskScene({ box: maskBox, canvas: mask.querySelector('canvas'), chapter: mask, next: document.getElementById('c2') });
  if (!off) maskBox.classList.add('no-gl');
}, noGl(maskBox));
const riverBox = river.querySelector('.river-pin');
lazy(river, 0.6, async () => {
  const { riverScene } = await import('./scenes/river.js');
  const off = await riverScene({ box: riverBox, canvas: river.querySelector('canvas'), chapter: river });
  if (!off) riverBox.classList.add('no-gl');
}, noGl(riverBox));
lazy(floor, 1.5, async () => {
  const { seabedScene } = await import('./scenes/seabed.js');
  const off = await seabedScene({ box: floor, canvas: floor.querySelector('canvas'), progress: progressRef });
  if (!off) floor.classList.add('no-gl');
}, noGl(floor));
void goHero; void subscribe;
