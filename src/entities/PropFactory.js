import * as THREE from 'three';
import { Materials } from '../materials/Materials.js';
import { rand } from '../utils/Rng.js';

// =============================================================================
// PropFactory — mobiliario urbano caraqueño para dar variedad a los chunks:
// palmeras, bancos y vallas publicitarias (letreros que se encienden de noche).
// =============================================================================

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 8);
const frondGeo = new THREE.BoxGeometry(1, 0.06, 0.5);

function box(mat, w, h, d, y = 0) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d); m.position.y = y;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export const PropFactory = {
  // Palmera (muy caraqueña): tronco + corona de hojas.
  palm(rng) {
    const g = new THREE.Group();
    const h = rand.range(rng, 4.5, 7);
    const trunk = new THREE.Mesh(trunkGeo, Materials.bark());
    trunk.scale.y = h; trunk.position.y = h / 2; trunk.castShadow = true;
    g.add(trunk);
    const leaf = Materials.foliage();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const fr = new THREE.Mesh(frondGeo, leaf);
      fr.scale.set(rand.range(rng, 2.2, 3.0), 1, 1);
      const a = (i / n) * Math.PI * 2;
      fr.position.set(Math.cos(a) * 1.2, h - 0.1 - Math.random() * 0.2, Math.sin(a) * 1.2);
      fr.rotation.y = -a;
      fr.rotation.z = 0.5 + Math.random() * 0.2;
      fr.castShadow = true;
      g.add(fr);
    }
    return g;
  },

  bench(rng) {
    const g = new THREE.Group();
    const wood = Materials.awning(0x6b4b2e);
    g.add(box(wood, 1.8, 0.12, 0.5, 0.5));
    g.add(box(wood, 1.8, 0.5, 0.12, 0.8)); // respaldo
    const legMat = Materials.metal(0x444a52);
    for (const sx of [-1, 1]) g.add(box(legMat, 0.1, 0.5, 0.5, 0.25).translateX(sx * 0.7));
    return g;
  },

  // Valla publicitaria: postes + panel emissive (letrero) que brilla de noche.
  billboard(rng) {
    const g = new THREE.Group();
    const color = rand.pick(rng, [0xffcf5a, 0xff5a4d, 0x2fb0d8, 0x53c07a, 0xe86bb0]);
    const post = Materials.metal(0x40464e);
    const w = rand.range(rng, 4.5, 6.5), ph = rand.range(rng, 3.5, 5);
    for (const sx of [-1, 1]) g.add(box(post, 0.22, ph, 0.22, ph / 2).translateX(sx * w * 0.35));
    const panelH = w * 0.4;
    const panel = box(Materials.sign(color), w, panelH, 0.2, ph + panelH / 2);
    g.add(panel);
    const frame = box(post, w * 1.06, panelH * 1.1, 0.12, ph + panelH / 2);
    g.add(frame);
    g.userData.height = ph + panelH;
    return g;
  }
};
