import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tokenColor, makeRenderer, runWhileVisible, resizeTo, prefersReduced } from './util.js';
import { clamp01, smoothstep } from '../lib/scroll.js';

const COLS = 54, ROWS = 32, STEP = 0.46;

// Which cells belong to the three slanted bars of the mark (monochrome, drawn in cells).
function markCells() {
  const set = new Map();
  const bars = [{ z: -3, shear: 1 }, { z: 0, shear: -1 }, { z: 3, shear: 1 }];
  bars.forEach((bar, bi) => {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -9; dx <= 9; dx++) {
        const x = dx + Math.round(dz * bar.shear * 1.6);
        const z = bar.z + dz;
        if (x < -COLS / 2 + 1 || x > COLS / 2 - 1) continue;
        set.set(`${x},${z}`, bi);
      }
    }
  });
  return set;
}

export async function seabedScene({ box, canvas, progress }) {
  const renderer = makeRenderer(canvas, { maxDpr: 1.5 });
  if (!renderer) return null;
  const still = prefersReduced();
  const floor = tokenColor('--color-floor');
  const scene = new THREE.Scene();
  scene.background = floor;
  scene.fog = new THREE.Fog(floor, 9, 24);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const lamp = new THREE.DirectionalLight(tokenColor('--color-ground'), 2.2);
  lamp.position.set(-4, 9, 5);
  scene.add(lamp, new THREE.AmbientLight(tokenColor('--color-paper-faint'), 0.55));

  const geo = new RoundedBoxGeometry(0.4, 0.4, 0.4, 2, 0.07);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  const cells = [];
  const marks = markCells();
  for (let r = -ROWS / 2; r < ROWS / 2; r++) {
    for (let c = -COLS / 2; c < COLS / 2; c++) {
      const bar = marks.has(`${c},${r}`);
      cells.push({ x: c * STEP, z: r * STEP * 1.0, c, r, bar, rand: Math.random(), base: 0.12 + 0.1 * Math.sin(c * 0.37) * Math.cos(r * 0.51) });
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cells.length * 3), 3);
  scene.add(mesh);

  // marks are scaled up so the mark reads at a distance
  const MARK_SCALE = 1;
  const dim = tokenColor('--color-paper-soft'), lite = tokenColor('--color-ground'), mid = tokenColor('--color-floor-faint');
  const col = new THREE.Color();

  let wide = true;
  const stopSize = resizeTo(renderer, camera, box, (w, h) => {
    wide = w > 760;
    camera.position.set(wide ? 1.4 : 0, wide ? 7.5 : 10, wide ? 9 : 11);
    camera.lookAt(wide ? 1.6 : 0, 0, wide ? 0.4 : -0.4);
    if (still) draw(0);
  });

  const ptr = { x: 99, z: 99, on: 0 }, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const move = (e) => {
    const r = box.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) { ptr.x = hit.x; ptr.z = hit.z; ptr.on = 1; }
  };
  const leave = () => { ptr.on = 0; };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerdown', move);
  box.addEventListener('pointerleave', leave);

  const dummy = new THREE.Object3D();
  let t = 0, ripple = 0;
  function draw(dt) {
    if (!still) t += dt;
    const p = still ? 1 : progress.current;
    ripple += ((ptr.on) - ripple) * Math.min(1, dt * 4);
    for (let i = 0; i < cells.length; i++) {
      const k = cells[i];
      let y = k.base, s = 1, tone = 0.25 + k.base * 0.8;
      let lift = 0;
      if (k.bar) {
        const local = smoothstep(clamp01((p * 1.5 - k.rand * 0.5) / 0.6));
        lift = local * 1.15 * MARK_SCALE + (1 - local) * (k.rand * 7 + 2);
        y = (1 - local) * (k.rand * 7) + local * (k.base + 0.55);
        s = 1 + local * 0.55;
        tone = 0.35 + local * 0.65;
        if (local < 0.02) { y = -2; }
      }
      const dx = k.x - ptr.x, dz = k.z - ptr.z, d = Math.sqrt(dx * dx + dz * dz);
      if (ripple > 0.01) {
        const w = Math.exp(-d * 0.9) * ripple;
        y += Math.sin(d * 3.2 - t * 4) * 0.22 * w + w * 0.2;
        tone += w * 0.4;
      }
      if (!still) y += Math.sin(t * 0.8 + k.c * 0.4 + k.r * 0.3) * 0.02;
      dummy.position.set(k.x, y, k.z);
      dummy.scale.set(1, s, 1);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      const f = Math.min(1, tone);
      col.copy(dim).lerp(f > 0.6 ? lite : mid, Math.min(1, Math.abs(f - 0.3) * 1.4));
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    renderer.render(scene, camera);
  }
  const stop = runWhileVisible(box, draw, { still });
  return () => {
    stop(); stopSize();
    box.removeEventListener('pointermove', move); box.removeEventListener('pointerdown', move); box.removeEventListener('pointerleave', leave);
    geo.dispose(); mat.dispose(); renderer.dispose();
  };
}
