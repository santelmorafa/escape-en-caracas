import * as THREE from 'three';
import { Materials } from '../materials/Materials.js';

// =============================================================================
// LandmarkFactory — hitos reconocibles de Caracas (versiones 3D simplificadas
// pero identificables). Se colocan como escenografía a un costado del corredor.
//   - obelisco   : Obelisco de Plaza Francia (Altamira)
//   - elSilencio : Torres de El Silencio (Centro Simón Bolívar)
//   - parqueCentral: Torres de Parque Central (octogonales, las más altas)
//   - torreDavid : Torre de David (rascacielos inconcluso)
// Cada uno devuelve un THREE.Group. Son decorativos (sin colisión de juego).
// =============================================================================

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function box(mat, w, h, d, y = h / 2) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.y = y;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function octPrism(mat, radius, height) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.02, height, 8);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export const LandmarkFactory = {
  // Lista rotada por el WorldGenerator para repartir hitos.
  order: ['obelisco', 'elSilencio', 'parqueCentral', 'torreDavid'],

  labels: {
    obelisco: 'Obelisco de Altamira',
    elSilencio: 'Torres de El Silencio',
    parqueCentral: 'Torres de Parque Central',
    torreDavid: 'Torre de David'
  },

  create(kind) {
    switch (kind) {
      case 'obelisco': return this._obelisco();
      case 'elSilencio': return this._elSilencio();
      case 'parqueCentral': return this._parqueCentral();
      case 'torreDavid': return this._torreDavid();
      default: return new THREE.Group();
    }
  },

  _obelisco() {
    const g = new THREE.Group();
    const white = Materials.concrete(0xe9e6dd);
    // plaza base
    g.add(box(Materials.sidewalk ? Materials.concrete(0xbfae8e) : white, 16, 0.4, 16, 0.2));
    // pedestal escalonado
    g.add(box(white, 5, 1.2, 5, 0.8));
    g.add(box(white, 3.4, 1.0, 3.4, 1.9));
    // fuste ahusado (obelisco)
    const shaftGeo = new THREE.CylinderGeometry(0.25, 1.1, 26, 4);
    const shaft = new THREE.Mesh(shaftGeo, white);
    shaft.rotation.y = Math.PI / 4;
    shaft.position.y = 2.4 + 13;
    shaft.castShadow = true;
    g.add(shaft);
    // punta
    const tipGeo = new THREE.ConeGeometry(0.35, 1.6, 4);
    const tip = new THREE.Mesh(tipGeo, Materials.metal(0xc0c0b0));
    tip.rotation.y = Math.PI / 4;
    tip.position.y = 2.4 + 26 + 0.8;
    g.add(tip);
    g.userData.height = 30;
    return g;
  },

  _elSilencio() {
    // dos torres residenciales cóncavas enfrentadas (bloques con muchas ventanas)
    const g = new THREE.Group();
    const mat = Materials.facade(1);
    for (const sx of [-1, 1]) {
      const t = box(mat, 10, 34, 7);
      t.position.set(sx * 9, 17, 0);
      g.add(t);
      // coronación
      const cap = box(Materials.concrete(0x8f8a80), 10.6, 0.8, 7.6, 34.4);
      cap.position.x = sx * 9;
      g.add(cap);
    }
    // arco/base que las une
    g.add(box(Materials.concrete(0xbdb6a8), 22, 3, 8, 1.5));
    g.userData.height = 35;
    return g;
  },

  _parqueCentral() {
    // dos torres octogonales de concreto, muy altas
    const g = new THREE.Group();
    const mat = Materials.concrete(0x8d867a);
    for (const sx of [-1, 1]) {
      const t = octPrism(mat, 6, 56);
      t.position.set(sx * 11, 28, 0);
      g.add(t);
      // franjas horizontales (pisos técnicos)
      for (let y = 6; y < 56; y += 6) {
        const ring = octPrism(Materials.concrete(0x6f6a60), 6.15, 0.6);
        ring.position.set(sx * 11, y, 0);
        g.add(ring);
      }
      // antena/coronación
      const cap = octPrism(Materials.concrete(0x777168), 5, 3);
      cap.position.set(sx * 11, 57.5, 0);
      g.add(cap);
    }
    g.userData.height = 60;
    return g;
  },

  _torreDavid() {
    // rascacielos inconcluso: concreto gris, pisos expuestos, sin vidrios,
    // silueta algo irregular.
    const g = new THREE.Group();
    const raw = Materials.concrete(0x7c766c);
    const core = box(raw, 14, 48, 14, 24);
    g.add(core);
    // losas de piso salientes (expuestas)
    for (let y = 4; y < 48; y += 3.4) {
      const slab = box(Materials.concrete(0x8a847a), 15.2, 0.35, 15.2, y);
      g.add(slab);
    }
    // columnas expuestas en la fachada
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const col = box(raw, 0.8, 48, 0.8, 24);
        col.position.set(sx * 7, 24, sz * 7);
        g.add(col);
      }
    }
    // parte superior irregular (obra detenida)
    const top = box(raw, 9, 6, 9, 51);
    top.position.x = 2;
    g.add(top);
    g.userData.height = 54;
    return g;
  }
};
