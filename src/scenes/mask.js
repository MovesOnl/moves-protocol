import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { tokenColor, makeRenderer, runWhileVisible, prefersReduced } from './util.js';
import { scrollY, viewH, docTop, clamp01 } from '../lib/scroll.js';

const g2 = (v, c, s) => Math.exp(-(((v - c) / s) ** 2));

// A head shaped from an icosphere: faceted triangles, brow, nose, jaw. Built in code, no scan asset.
function headGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 0.78, y = p.getY(i) * 1.08, z = p.getZ(i) * 0.9;
    const jaw = THREE.MathUtils.clamp((-0.15 - y) / 0.9, 0, 1);
    x *= 1 - 0.38 * jaw; z *= 1 - 0.18 * jaw;
    if (z < 0) z *= 1.06;
    const front = z > 0 ? 1 : 0;
    z += front * 0.24 * g2(x, 0, 0.11) * g2(y, -0.1, 0.28);       // nose
    z += front * 0.07 * g2(y, 0.24, 0.08) * g2(x, 0, 0.5);        // brow
    z -= front * 0.1 * g2(Math.abs(x), 0.27, 0.13) * g2(y, 0.17, 0.09); // eye sockets
    z -= front * 0.05 * g2(x, 0, 0.2) * g2(y, -0.5, 0.05);        // mouth
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

const VERT_HEAD = `
attribute vec3 aCenter; attribute vec3 aDir; attribute float aRand;
uniform float uShatter; uniform vec3 uLens; uniform float uLensOn; uniform float uTime;
mat3 spin(vec3 axis, float a){ axis = normalize(axis); float s = sin(a), c = cos(a), oc = 1.0 - c;
  return mat3(oc*axis.x*axis.x + c, oc*axis.x*axis.y + axis.z*s, oc*axis.z*axis.x - axis.y*s,
              oc*axis.x*axis.y - axis.z*s, oc*axis.y*axis.y + c, oc*axis.y*axis.z + axis.x*s,
              oc*axis.z*axis.x + axis.y*s, oc*axis.y*axis.z - axis.x*s, oc*axis.z*axis.z + c); }
`;
const SHATTER = `
float order = clamp((aCenter.y + 1.2) / 2.4, 0.0, 1.0);
float wave = clamp((uShatter * 1.6 - (1.0 - order) * 0.45 - aRand * 0.25) / 0.6, 0.0, 1.0);
float lens = uLensOn * (1.0 - smoothstep(0.2, 0.7, distance(aCenter, uLens)));
float amt = max(wave * wave * (3.0 - 2.0 * wave), lens * 0.35);
vec3 local = position - aCenter;
local = spin(aDir + vec3(0.3, 0.7, 0.1), amt * (2.5 + aRand * 4.0)) * local * (1.0 - amt * 0.55);
vec3 drift = aDir * amt * (1.0 + aRand * 2.0) + vec3(0.0, amt * amt * (0.5 + aRand), 0.0);
drift += vec3(sin(uTime * 0.8 + aRand * 20.0), cos(uTime * 0.6 + aRand * 13.0), 0.0) * amt * 0.07;
vec3 transformed = aCenter + local + drift;
`;

export async function maskScene({ box, canvas, chapter, next }) {
  const renderer = makeRenderer(canvas, { alpha: true, maxDpr: 1.5 });
  if (!renderer) return null;
  const still = prefersReduced();
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture; scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.1, 9);
  const light = tokenColor('--color-ground');
  [[2.4, -3, 3, 4], [3.2, 4, 1.5, -3], [1.6, -4, -1, -2]].forEach(([i, x, y, z]) => { const l = new THREE.DirectionalLight(light, i); l.position.set(x, y, z); scene.add(l); });

  // faceted mask: one triangle at a time so each can fly apart
  const geo = headGeometry();
  const pos = geo.attributes.position;
  const tri = pos.count / 3;
  const centers = new Float32Array(pos.count * 3), dirs = new Float32Array(pos.count * 3), rands = new Float32Array(tri * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cen = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < tri; i++) {
    a.fromBufferAttribute(pos, i * 3); b.fromBufferAttribute(pos, i * 3 + 1); c.fromBufferAttribute(pos, i * 3 + 2);
    cen.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    if (n.dot(cen) < 0) n.negate();
    const r = Math.random();
    for (let k = 0; k < 3; k++) { cen.toArray(centers, (i * 3 + k) * 3); n.toArray(dirs, (i * 3 + k) * 3); rands[i * 3 + k] = r; }
  }
  geo.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rands, 1));
  geo.computeVertexNormals();

  const U = { uShatter: { value: 0 }, uLens: { value: new THREE.Vector3(0, 0, 10) }, uLensOn: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: tokenColor('--color-coal'), roughness: 0.32, metalness: 0.75, flatShading: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', SHATTER);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(1.035);

  // dot skin just under the mask
  const N = 7000, dots = new Float32Array(N * 3), v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const t = Math.floor(Math.random() * tri);
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    v.copy(a).multiplyScalar(1 - u - w).addScaledVector(b, u).addScaledVector(c, w).multiplyScalar(0.975);
    v.toArray(dots, i * 3);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dots, 3));
  const show = { value: 0 };
  const dmat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uShow: show, uColor: { value: tokenColor('--color-paper') }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `uniform float uTime; uniform float uPx; varying float vScan;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float band = fract(uTime * 0.18) * 4.0 - 2.0;
        vScan = exp(-pow((position.y - band) * 3.0, 2.0));
        gl_PointSize = (1.6 + vScan * 2.2) * uPx * (9.0 / -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uShow; uniform vec3 uColor; varying float vScan;
      void main(){ vec2 p = gl_PointCoord - 0.5; if (dot(p, p) > 0.25) discard;
        gl_FragColor = vec4(uColor, (0.35 + vScan * 0.65) * uShow); }`,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(dgeo, dmat);
  const head = new THREE.Group();
  head.add(points, mesh);
  scene.add(head);

  let W = 1, H = 1, wide = true, cTop = 0, nTop = 0, cH = 1;
  const layout = () => {
    cTop = docTop(chapter); nTop = docTop(next); cH = chapter.offsetHeight;
    W = box.clientWidth; H = box.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; wide = W > 860; camera.updateProjectionMatrix();
    head.position.set(wide ? 1.55 : 0, wide ? -0.05 : 1.2, 0);
    head.scale.setScalar(wide ? 1.5 : 0.95);
    if (still) draw(0);
  };
  const ro = new ResizeObserver(layout);
  ro.observe(box); chapter.parentElement && ro.observe(chapter.parentElement);
  window.addEventListener('resize', layout);

  const ptr = { x: 0, y: 0, tx: 0, ty: 0, on: 0 };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
  let hit = false;
  const move = (e) => {
    const r = box.getBoundingClientRect();
    ptr.tx = (e.clientX - r.left) / r.width - 0.5; ptr.ty = (e.clientY - r.top) / r.height - 0.5;
    ndc.set(ptr.tx * 2, -ptr.ty * 2); ray.setFromCamera(ndc, camera);
    const h = ray.intersectObject(mesh, false)[0];
    hit = !!h;
    if (h) U.uLens.value.copy(mesh.worldToLocal(tmp.copy(h.point)));
  };
  const leave = () => { hit = false; ptr.tx = 0; ptr.ty = 0; };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerleave', leave);

  let t = 0, amt = 0;
  function draw(dt) {
    const vh = viewH(), sy = scrollY();
    const rel = cTop - sy;
    if (!still && (rel >= vh || nTop - sy <= 0)) return;
    if (!still) t += dt;
    U.uTime.value = t;
    const target = still ? 0 : clamp01(-rel / Math.max(1, cH - vh));
    amt += (target - amt) * Math.min(1, dt * 5);
    U.uShatter.value = amt;
    ptr.on += ((hit && !still ? 1 : 0) - ptr.on) * Math.min(1, dt * 6);
    U.uLensOn.value = ptr.on;
    show.value = Math.min(1, 0.12 + amt * 1.4 + ptr.on * 0.5);
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 3); ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 3);
    head.rotation.y = (wide ? -0.32 : 0) + ptr.x * 0.9 + (still ? 0 : Math.sin(t * 0.4) * 0.06);
    head.rotation.x = ptr.y * 0.45 + (still ? 0 : Math.sin(t * 0.55) * 0.03);
    renderer.render(scene, camera);
  }
  layout();
  const stop = runWhileVisible(box, draw, { still });
  return () => {
    stop(); ro.disconnect(); window.removeEventListener('resize', layout);
    box.removeEventListener('pointermove', move); box.removeEventListener('pointerleave', leave);
    geo.dispose(); dgeo.dispose(); mat.dispose(); dmat.dispose(); env.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose();
  };
}
