// Scroll store: one passive listener, one rAF fan-out. Lenis (when present) feeds the same store.
let y = 0;
let vh = 0;
let ready = false;
let frame = 0;
let smooth = null;
const subs = new Set();

function flush() {
  frame = 0;
  subs.forEach((fn) => fn());
}
function queue() {
  if (!frame) frame = requestAnimationFrame(flush);
}
function boot() {
  if (ready) return;
  ready = true;
  y = window.scrollY;
  vh = window.innerHeight;
  window.addEventListener('scroll', () => { if (!smooth) { y = window.scrollY; queue(); } }, { passive: true });
  window.addEventListener('resize', () => { vh = window.innerHeight; y = window.scrollY; queue(); });
}

export const scrollY = () => (boot(), y);
export const viewH = () => (boot(), vh);
export const smoothActive = () => smooth !== null;
export function subscribe(fn) { boot(); subs.add(fn); return () => subs.delete(fn); }
export function attachSmooth(lenis) {
  boot();
  smooth = lenis;
  y = window.scrollY;
  if (!lenis) { queue(); return; }
  lenis.on('scroll', () => { y = window.scrollY; flush(); });
  flush();
}
export function scrollToY(top, animated) {
  if (smooth) smooth.scrollTo(top, { immediate: !animated, force: true });
  else window.scrollTo({ top, behavior: animated ? 'smooth' : 'auto' });
}

// Layout position of an element ignoring sticky offsets: parent top plus heights of earlier siblings.
export function docTop(el) {
  const p = el.parentElement;
  let t = p ? p.getBoundingClientRect().top + window.scrollY : 0;
  for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (s instanceof HTMLElement) t += s.offsetHeight;
  return t;
}
export function offsetWithin(el, root) {
  let t = 0;
  for (let n = el; n instanceof HTMLElement && n !== root; n = n.offsetParent) t += n.offsetTop;
  return t;
}
export function offsetLeftWithin(el, root) {
  let t = 0;
  for (let n = el; n instanceof HTMLElement && n !== root; n = n.offsetParent) t += n.offsetLeft;
  return t;
}
// Where a sticky chapter actually sits in the viewport, clamped by its sticky top.
export const visTop = (top, height, sy, vhNow) => Math.max(top - sy, Math.min(0, vhNow - height));

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smoothstep = (v) => v * v * (3 - 2 * v);
// Back-out ease with overshoot, used for cards and stamps.
export const backOut = (m) => (m >= 1 ? 1 : 1 + 2.9 * Math.pow(m - 1, 3) + 1.9 * Math.pow(m - 1, 2));
