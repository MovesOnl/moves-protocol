import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tokenColor, makeRenderer, runWhileVisible, resizeTo, prefersReduced } from './util.js';
import { scrollY, viewH, docTop, clamp01 } from '../lib/scroll.js';

// A pale island: four streams join one river that runs past a small house and a dock.
// Plain cubes ride the water. No coins, no logos.
export async function riverScene({ box, canvas, chapter }) {
  const renderer = makeRenderer(canvas, { alpha: true, maxDpr: 1.75 });
  if (!renderer) return null;
  const still = prefersReduced();
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
  const ground = tokenColor('--color-ground');
  const ink = tokenColor('--color-coal');
  scene.add(new THREE.HemisphereLight(ground, ink, 1.1));
  const sun = new THREE.DirectionalLight(ground, 2.6);
  sun.position.set(-5, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  const slabMat = new THREE.MeshStandardMaterial({ color: ground, roughness: 0.92 });
  const slab = new RoundedBoxGeometry(9.4, 0.7, 7.4, 3, 0.18);
  const island = new THREE.Mesh(slab, slabMat);
  island.position.y = -0.35; island.receiveShadow = true; island.castShadow = true;
  world.add(island);

  // water paths (y = surface)
  const Y = 0.02;
  const join = new THREE.Vector3(0.2, Y, 0.1);
  const starts = [-3.4, -1.15, 1.2, 3.5];
  const streams = starts.map((x, i) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, Y, -3.5),
    new THREE.Vector3(x * 0.8, Y, -2.1),
    new THREE.Vector3(x * 0.35 + 0.1 * i, Y, -0.8),
    join,
  ]));
  const river = new THREE.CatmullRomCurve3([join, new THREE.Vector3(0.9, Y, 1.2), new THREE.Vector3(0.2, Y, 2.4), new THREE.Vector3(0.7, Y, 3.7)]);
  const waterMat = new THREE.MeshStandardMaterial({ color: ink, roughness: 0.25, metalness: 0.2 });
  const tubes = [];
  streams.forEach((c) => {
    const g = new THREE.TubeGeometry(c, 48, 0.16, 8, false);
    const m = new THREE.Mesh(g, waterMat); m.scale.y = 0.35; m.position.y = 0.01; world.add(m); tubes.push(g);
  });
  const rg = new THREE.TubeGeometry(river, 64, 0.34, 10, false);
  const rm = new THREE.Mesh(rg, waterMat); rm.scale.y = 0.35; rm.position.y = 0.01; world.add(rm); tubes.push(rg);

  // house and dock
  const wall = new THREE.MeshStandardMaterial({ color: ground, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: ink, roughness: 0.5 });
  const house = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.9), wall);
  house.position.set(-2.2, 0.4, 1.4); house.castShadow = true; world.add(house);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.6, 4), roofMat);
  roof.position.set(-2.2, 1.1, 1.4); roof.rotation.y = Math.PI / 4; roof.castShadow = true; world.add(roof);
  const dock = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), wall);
  dock.position.set(-0.45, 0.14, 2.1); dock.castShadow = true; world.add(dock);

  // cubes riding the water; they turn over as they pass the dock
  const PER = 7, COUNT = streams.length * PER;
  const cubeGeo = new RoundedBoxGeometry(0.17, 0.17, 0.17, 2, 0.03);
  const cubeMat = new THREE.MeshStandardMaterial({ color: ground, roughness: 0.4 });
  const cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, COUNT);
  cubes.castShadow = true; world.add(cubes);
  const phase = Array.from({ length: COUNT }, (_, i) => (i % PER) / PER + Math.random() * 0.05);
  const dummy = new THREE.Object3D(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
  const place = (time) => {
    for (let i = 0; i < COUNT; i++) {
      const s = Math.floor(i / PER);
      const t = (phase[i] + time * 0.05) % 1;
      const sp = 0.55; // share of the trip spent on a stream
      if (t < sp) streams[s].getPointAt(t / sp, pa); else river.getPointAt((t - sp) / (1 - sp), pa);
      const flip = t > sp + 0.25 ? clamp01((t - sp - 0.25) / 0.25) : 0;
      dummy.position.set(pa.x, 0.16 + Math.sin(time * 2 + i) * 0.015, pa.z);
      dummy.rotation.set(flip * Math.PI, t * 6, 0);
      dummy.scale.setScalar(t > 0.96 ? (1 - t) / 0.04 : t < 0.03 ? t / 0.03 : 1);
      dummy.updateMatrix(); cubes.setMatrixAt(i, dummy.matrix);
    }
    cubes.instanceMatrix.needsUpdate = true;
  };

  let wide = true, cTop = 0, cH = 1;
  const stopSize = resizeTo(renderer, camera, box, (w) => {
    wide = w > 860;
    cTop = docTop(chapter); cH = chapter.offsetHeight;
    world.position.set(wide ? 2.4 : 0, wide ? 0 : -0.6, 0);
    world.scale.setScalar(wide ? 1 : 0.78);
    camera.position.set(0, wide ? 11 : 15, wide ? 12 : 17);
    camera.lookAt(0, 0, 0);
    if (still) draw(0);
  });

  let t = 0;
  function draw(dt) {
    const vh = viewH(), sy = scrollY();
    if (!still && (cTop - sy >= vh || cTop + cH - sy <= 0)) return;
    if (!still) t += dt;
    const p = still ? 0.5 : clamp01(-(cTop - sy) / Math.max(1, cH - vh) + 0.2);
    world.rotation.y = -0.65 + p * 0.55;
    place(t);
    renderer.render(scene, camera);
  }
  const stop = runWhileVisible(box, draw, { still });
  return () => {
    stop(); stopSize();
    [slab, rg, cubeGeo, ...tubes].forEach((g) => g.dispose());
    [slabMat, waterMat, wall, roofMat, cubeMat].forEach((m) => m.dispose());
    renderer.dispose();
  };
}
