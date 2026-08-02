import * as THREE from 'three';
import { Materials } from '../materials/Materials.js';
import { rand } from '../utils/Rng.js';

// =============================================================================
// CarFactory — carros realistas simplificados: carrocería metálica con brillo,
// cabina de vidrio oscuro, 4 ruedas cilíndricas. Devuelve un Group orientable.
// =============================================================================

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 16);

const CAR_COLORS = [0xb32d2d, 0x2d4bb3, 0xdedede, 0x1c1c1e, 0x3f7d4f, 0xcfa93a, 0x6b7078];

function part(geo, mat, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const CarFactory = {
  create(rng) {
    const g = new THREE.Group();
    const color = rand.pick(rng, CAR_COLORS);
    const bodyMat = Materials.carBody(color);
    const glass = Materials.glassDark();
    const rubber = Materials.rubber();

    const L = rand.range(rng, 3.8, 4.8);
    const W = 1.85;

    // chasis inferior
    const lower = part(boxGeo, bodyMat, W, 0.7, L);
    lower.position.y = 0.6;
    g.add(lower);

    // cabina
    const cabin = part(boxGeo, bodyMat, W * 0.92, 0.6, L * 0.5);
    cabin.position.set(0, 1.15, -L * 0.02);
    g.add(cabin);

    // vidrios (una banda continua)
    const windows = part(boxGeo, glass, W * 0.94, 0.5, L * 0.5 - 0.05);
    windows.position.set(0, 1.16, -L * 0.02);
    windows.scale.x = W * 0.95;
    g.add(windows);

    // ruedas
    const wy = 0.35, wx = W / 2 - 0.05, wz = L / 2 - 0.9;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeo, rubber);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * wx, wy, sz * wz);
        wheel.castShadow = true;
        g.add(wheel);
      }
    }

    // faros (emissive: se encienden de noche)
    const headMat = Materials.headlight();
    for (const sx of [-1, 1]) {
      const h = part(boxGeo, headMat, 0.35, 0.22, 0.1);
      h.position.set(sx * W * 0.32, 0.75, -L / 2 + 0.02);
      g.add(h);
    }
    // pilotos traseros (emissive rojo de noche)
    const tailMat = Materials.taillight();
    for (const sx of [-1, 1]) {
      const t = part(boxGeo, tailMat, 0.3, 0.18, 0.08);
      t.position.set(sx * W * 0.32, 0.78, L / 2 - 0.02);
      g.add(t);
    }

    g.userData.footprint = { w: W, l: L };
    return g;
  }
};
