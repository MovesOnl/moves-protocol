import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { tokenColor, tokenCss, makeRenderer, runWhileVisible, drawHeadline, prefersReduced } from './util.js';
import { scrollY } from '../lib/scroll.js';

const FONT = '800 100px "Inter Variable"';

export async function knotScene({ hero, canvas, backdrop, lines }) {
  const renderer = makeRenderer(canvas);
  if (!renderer) return null;
  const still = prefersReduced();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = tokenColor('--color-paper');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.03);
  scene.environment = envMap.texture;
  scene.environmentIntensity = 1.1;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  const key = new THREE.DirectionalLight(tokenColor('--color-ground'), 2.2); key.position.set(4, 6, 6);
  const rim = new THREE.DirectionalLight(tokenColor('--color-ground'), 1.4); rim.position.set(-6, -2, -4);
  scene.add(key, rim);

  // headline plane behind the knot
  const textCanvas = document.createElement('canvas');
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.colorSpace = THREE.SRGBColorSpace; textTex.anisotropy = 8;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textTex, toneMapped: false }));
  plane.position.z = -1.2;
  scene.add(plane);

  // stripe mask for the dark knot
  const stripe = document.createElement('canvas'); stripe.width = 1024; stripe.height = 8;
  const sx = stripe.getContext('2d');
  sx.fillStyle = tokenCss('--color-void'); sx.fillRect(0, 0, 1024, 8);
  sx.fillStyle = tokenCss('--color-ground');
  [[0, 70], [150, 205], [300, 350], [430, 470], [560, 640], [700, 780], [830, 905], [960, 1024]].forEach(([a, b]) => sx.fillRect(a, 0, b - a, 8));
  const stripeTex = new THREE.CanvasTexture(stripe);
  stripeTex.wrapS = THREE.RepeatWrapping;

  const group = new THREE.Group();
  scene.add(group);
  const glass = new THREE.MeshPhysicalMaterial({ color: tokenColor('--color-ground'), transmission: 1, thickness: 1.4, roughness: 0.04, ior: 1.5, dispersion: 7, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.2 });
  const geoA = new THREE.TorusKnotGeometry(1.15, 0.34, 420, 64, 2, 3);
  group.add(new THREE.Mesh(geoA, glass));
  const ink = new THREE.MeshPhysicalMaterial({ color: tokenColor('--color-coal'), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, alphaMap: stripeTex, alphaTest: 0.5 });
  const geoB = new THREE.TorusKnotGeometry(1.15, 0.343, 420, 64, 2, 3);
  group.add(new THREE.Mesh(geoB, ink));

  let W = 1, H = 1, wide = true, baseScale = 1;
  const layout = () => {
    W = hero.clientWidth; H = hero.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; wide = W > 760;
    camera.updateProjectionMatrix();
    const dist = camera.position.z - plane.position.z;
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist, vw = vh * camera.aspect;
    plane.scale.set(vw, vh, 1);
    baseScale = wide ? Math.min(1.25, vh * 0.105) : Math.min(0.62, vw * 0.13);
    group.position.set(wide ? vw * 0.08 : 0, wide ? -vh * 0.02 : vh * 0.06, 0);
    if (drawHeadline(textCanvas, W, H, lines)) textTex.needsUpdate = true;
    if (backdrop) drawHeadline(backdrop, W, H, lines);
    if (still) render(0);
  };
  const ro = new ResizeObserver(layout);
  ro.observe(hero);
  let disposed = false;
  document.fonts.load(FONT).then(() => { if (!disposed) layout(); });

  // pointer drag with inertia
  const spin = { x: 0.4, y: 0, vx: 0, vy: 0 };
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let drag = null;
  const down = (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; };
  const move = (e) => {
    const r = hero.getBoundingClientRect();
    tilt.tx = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
    tilt.ty = ((e.clientX - r.left) / r.width - 0.5) * 0.7;
    if (drag) {
      spin.vy = (e.clientX - drag.x) * 0.006; spin.vx = (e.clientY - drag.y) * 0.006;
      spin.y += spin.vy; spin.x += spin.vx;
      drag = { x: e.clientX, y: e.clientY };
    }
  };
  const up = () => { drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.style.cursor = 'grab';

  let t = 0, intro = 0;
  const render = (dt) => {
    const scrolled = still ? 0 : Math.min(1, scrollY() / Math.max(1, H));
    if (!still) t += dt;
    if (!drag) {
      spin.vy *= Math.pow(0.15, dt); spin.vx *= Math.pow(0.15, dt);
      spin.y += spin.vy + (still ? 0 : dt * 0.22); spin.x += spin.vx;
    }
    tilt.x += (tilt.tx - tilt.x) * 0.06; tilt.y += (tilt.ty - tilt.y) * 0.06;
    intro = still ? 1 : Math.min(1, t / 1.6);
    const spring = intro >= 1 ? 1 : 1 - Math.pow(2, -10 * intro) * Math.cos(intro * Math.PI * 3.2);
    group.scale.setScalar(baseScale * spring * (1 - scrolled * 0.25));
    group.rotation.set(spin.x + tilt.x + scrolled * 1.4 + Math.sin(t * 0.5) * 0.08, spin.y + tilt.y + (1 - spring) * 2.4 + scrolled * 2.2, Math.sin(t * 0.3) * 0.1);
    renderer.render(scene, camera);
  };
  layout();
  const stop = runWhileVisible(hero, (dt) => { if (scrollY() > H * 1.05) return; render(dt); }, { still });

  return () => {
    disposed = true; stop(); ro.disconnect();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
    [geoA, geoB, plane.geometry].forEach((g) => g.dispose());
    [glass, ink, plane.material].forEach((m) => m.dispose());
    [textTex, stripeTex].forEach((x) => x.dispose());
    envMap.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose();
  };
}
