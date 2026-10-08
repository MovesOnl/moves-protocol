import * as THREE from 'three';

// Colours come from the tokens file through CSS custom properties, never from literals here.
export const tokenCss = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export function tokenColor(name) {
  return new THREE.Color(tokenCss(name));
}
export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function makeRenderer(canvas, opts = {}) {
  try {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', ...opts });
    r.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxDpr || 2));
    return r;
  } catch {
    return null;
  }
}

// Calls draw(dt) every frame while the box is on screen and the tab is visible.
export function runWhileVisible(box, draw, { still = false } = {}) {
  let on = true, raf = 0, prev = performance.now();
  const io = new IntersectionObserver(([e]) => { on = e ? e.isIntersecting : true; });
  io.observe(box);
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (!on || document.hidden) return;
    draw(dt);
  };
  if (still) draw(0);
  else raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); io.disconnect(); };
}

export function resizeTo(renderer, camera, box, cb) {
  const apply = () => {
    const w = Math.max(1, box.clientWidth), h = Math.max(1, box.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    cb && cb(w, h);
  };
  const ro = new ResizeObserver(apply);
  ro.observe(box);
  apply();
  return () => ro.disconnect();
}

export function drawHeadline(canvas, w, h, lines) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = tokenCss('--color-paper');
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = tokenCss('--color-coal');
  ctx.textBaseline = 'alphabetic';
  const font = '"Inter Variable", "Helvetica Neue", Arial, sans-serif';
  const padX = Math.max(16, w * 0.045);
  const topPad = Math.max(130, h * 0.14);
  const usable = h * (w > 760 ? 0.84 : 0.62);
  const innerW = w - padX * 2;
  const rowH = (usable - topPad) / lines.length;
  lines.forEach((text, i) => {
    ctx.font = `800 200px ${font}`;
    ctx.letterSpacing = '-0.02em';
    const size = Math.min((200 * innerW) / ctx.measureText(text).width, rowH * 1.18);
    ctx.font = `800 ${size}px ${font}`;
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, padX + (innerW - tw) / 2, topPad + rowH * (i + 1) - rowH * 0.1);
  });
  return true;
}
