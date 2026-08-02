import * as THREE from 'three';
import { Materials } from '../materials/Materials.js';
import { CarFactory } from './CarFactory.js';
import { rand } from '../utils/Rng.js';

// =============================================================================
// ObstacleFactory — obstáculos urbanos superables.
// Cada obstáculo declara CÓMO se supera vía `pass`:
//   'over'   -> saltar por encima (muro bajo, valla)
//   'under'  -> deslizarse por debajo (andamio, barra)
//   'around' -> esquivar lateralmente (contenedor, carro, kiosco)
// Devuelve { group, colliders:[{ pass, box:Box3(local) }] } — la caja está en
// coordenadas locales al group; el Chunk la traslada a mundo.
// =============================================================================

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function mesh(mat, w, h, d, y = h / 2) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.y = y;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function localBox(w, h, d, y0, y1) {
  return new THREE.Box3(
    new THREE.Vector3(-w / 2, y0, -d / 2),
    new THREE.Vector3(w / 2, y1, d / 2)
  );
}

const TYPES = ['lowwall', 'barrier', 'container', 'car', 'kiosk', 'scaffold', 'dumpster'];

export const ObstacleFactory = {
  types: TYPES,

  create(rng, type) {
    const g = new THREE.Group();
    const colliders = [];

    switch (type) {
      case 'lowwall': {
        const w = rand.range(rng, 2.5, 4.5), h = 1.0, d = 0.6;
        g.add(mesh(Materials.concrete(0x9c968b), w, h, d));
        colliders.push({ pass: 'over', box: localBox(w, h, d, 0, h) });
        break;
      }
      case 'barrier': {
        const w = 2.2, h = 1.1, d = 0.4;
        const bar = mesh(Materials.warning(), w, h, d);
        g.add(bar);
        // patas
        for (const sx of [-1, 1]) {
          const leg = mesh(Materials.metal(0x555a60), 0.12, h, 0.5, h / 2);
          leg.position.x = sx * w * 0.4;
          g.add(leg);
        }
        colliders.push({ pass: 'over', box: localBox(w, h, d, 0, h) });
        break;
      }
      case 'container': {
        const w = 2.4, h = 2.6, d = 6.0;
        g.add(mesh(Materials.paintedMetal(rand.pick(rng, [0xb5892a, 0x2f6b57, 0x9c3b34])), w, h, d));
        colliders.push({ pass: 'around', box: localBox(w, h, d, 0, h) });
        break;
      }
      case 'car': {
        const car = CarFactory.create(rng);
        car.rotation.y = Math.PI / 2 * (rand.chance(rng, 0.5) ? 1 : -1);
        g.add(car);
        const fp = car.userData.footprint;
        colliders.push({ pass: 'around', box: localBox(fp.l, 1.5, fp.w, 0, 1.5) });
        break;
      }
      case 'kiosk': {
        const w = 2.2, h = 2.8, d = 2.2;
        g.add(mesh(Materials.paintedMetal(0x2f6b57), w, h, d));
        // techo
        const roof = mesh(Materials.metal(0x777), w * 1.2, 0.2, d * 1.2, h + 0.1);
        g.add(roof);
        colliders.push({ pass: 'around', box: localBox(w, h, d, 0, h) });
        break;
      }
      case 'scaffold': {
        // andamio: barra alta con espacio para deslizarse debajo
        const w = 5.0, postH = 3.2;
        const barY = 1.6; // altura del hueco: hay que agacharse
        const mat = Materials.metal(0x8a8f96);
        for (const sx of [-1, 1]) {
          const post = mesh(mat, 0.18, postH, 0.18, postH / 2);
          post.position.x = sx * w * 0.45;
          g.add(post);
        }
        const topBar = mesh(mat, w, 0.25, 0.25, postH - 0.2);
        g.add(topBar);
        const midBar = mesh(mat, w, 0.2, 0.2, barY);
        g.add(midBar);
        // lona
        const tarp = mesh(Materials.warning(), w, 1.2, 0.05, postH - 0.8);
        g.add(tarp);
        // colisión: parte superior sólida por debajo de la cual hay que pasar
        colliders.push({ pass: 'under', box: localBox(w, postH, 1.0, barY, postH) });
        break;
      }
      case 'dumpster': {
        const w = 2.0, h = 1.4, d = 1.6;
        g.add(mesh(Materials.paintedMetal(0x3f6b34), w, h, d));
        colliders.push({ pass: 'over', box: localBox(w, h, d, 0, h) });
        break;
      }
    }

    return { group: g, colliders };
  }
};
