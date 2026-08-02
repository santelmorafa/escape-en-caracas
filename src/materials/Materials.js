import * as THREE from 'three';
import { ProceduralTextures as PT } from './ProceduralTextures.js';
import { CONFIG } from '../config.js';

// =============================================================================
// Fábrica de materiales PBR reutilizables. Centraliza la creación para poder
// intercambiar texturas procedurales por reales sin tocar el resto del juego.
// Los materiales se cachean: geometría instanciada + material compartido = perf.
//
// EMISSIVE de noche (ventanas, faros, letreros): los materiales se registran en
// `_nightMats` y Materials.setNight(nf) sube su emissiveIntensity con el
// nightFactor. Es GRATIS en rendimiento (no son luces, sólo emisión).
// =============================================================================

const _mat = new Map();
const _nightMats = [];   // [{mat, dayI, nightI}]

function cached(key, factory) {
  if (_mat.has(key)) return _mat.get(key);
  const m = factory();
  _mat.set(key, m);
  return m;
}

function registerNight(mat, dayI, nightI) {
  _nightMats.push({ mat, dayI, nightI });
  return mat;
}

export const Materials = {
  asphalt() {
    return cached('asphalt', () => {
      const t = PT.asphalt(6);
      return new THREE.MeshStandardMaterial({
        map: t.map, normalMap: t.normalMap,
        roughness: 0.95, metalness: 0.0,
        normalScale: new THREE.Vector2(0.8, 0.8)
      });
    });
  },

  sidewalk() {
    return cached('sidewalk', () => {
      const t = PT.sidewalk(3);
      return new THREE.MeshStandardMaterial({
        map: t.map, normalMap: t.normalMap,
        roughness: 0.9, metalness: 0.0
      });
    });
  },

  // Fachadas variadas para dar diversidad urbana.
  facade(variant = 0) {
    const palettes = [
      { base: '#c2b8a6', glass: '#3a5570', cols: 5, rows: 7 },
      { base: '#a89f93', glass: '#2f4a5e', cols: 6, rows: 9 },
      { base: '#d8cbb2', glass: '#42627d', cols: 4, rows: 6 },
      { base: '#9a9186', glass: '#33485c', cols: 7, rows: 10 },
      { base: '#b7654a', glass: '#3a5570', cols: 5, rows: 8 }, // ladrillo/ocre
      { base: '#8fae9c', glass: '#2f4a5e', cols: 5, rows: 8 }, // verde agua (barrio)
      { base: '#c9a24a', glass: '#3a5570', cols: 4, rows: 7 }, // mostaza
      { base: '#7f97b3', glass: '#33485c', cols: 6, rows: 8 }, // azul grisáceo
      { base: '#c96f86', glass: '#42627d', cols: 5, rows: 6 }  // rosa/terracota
    ];
    const p = palettes[variant % palettes.length];
    return cached('facade' + variant, () => {
      const t = PT.facade(p);
      const m = new THREE.MeshStandardMaterial({
        map: t.map, normalMap: t.normalMap,
        roughness: 0.8, metalness: 0.05,
        emissiveMap: t.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0            // 0 de día; sube de noche (ventanas)
      });
      return registerNight(m, 0, CONFIG.night.windowEmissive);
    });
  },

  // Faros de carro: emissive cálido que se enciende de noche.
  headlight() {
    return cached('headlight', () => {
      const m = new THREE.MeshStandardMaterial({
        color: 0xf5f0d8, roughness: 0.4, metalness: 0.2,
        emissive: new THREE.Color(0xfff2c0), emissiveIntensity: 0
      });
      return registerNight(m, 0, CONFIG.night.headlightEmissive);
    });
  },

  // Piloto trasero rojo (emissive de noche).
  taillight() {
    return cached('taillight', () => {
      const m = new THREE.MeshStandardMaterial({
        color: 0x5a0d0d, roughness: 0.4, metalness: 0.2,
        emissive: new THREE.Color(0xff2a2a), emissiveIntensity: 0
      });
      return registerNight(m, 0, 1.6);
    });
  },

  // Letrero / valla publicitaria: color de anuncio con emissive que se enciende
  // de noche (gratis, no es luz). Registrado en el controlador nocturno.
  sign(color = 0xffcf5a) {
    return cached('sign' + color, () => {
      const m = new THREE.MeshStandardMaterial({
        color, roughness: 0.5, metalness: 0.0,
        emissive: new THREE.Color(color), emissiveIntensity: 0
      });
      return registerNight(m, 0.05, 1.5);
    });
  },

  awning(color) {
    return cached('awning' + color, () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0 }));
  },

  bark() {
    return cached('bark', () =>
      new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95, metalness: 0.0 }));
  },

  // Sube/baja el emissive de todos los materiales nocturnos según nf (0..1).
  setNight(nf) {
    for (const e of _nightMats) {
      e.mat.emissiveIntensity = e.dayI + (e.nightI - e.dayI) * nf;
    }
  },

  concrete(color = 0x9a958c) {
    return cached('concrete' + color, () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 }));
  },

  carBody(color) {
    // material único por color de carro (brillo metálico)
    return new THREE.MeshStandardMaterial({
      color, roughness: 0.35, metalness: 0.85,
      envMapIntensity: 1.1
    });
  },

  glassDark() {
    return cached('glassDark', () =>
      new THREE.MeshStandardMaterial({
        color: 0x10161c, roughness: 0.1, metalness: 0.6,
        transparent: true, opacity: 0.85
      }));
  },

  rubber() {
    return cached('rubber', () =>
      new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.95, metalness: 0.0 }));
  },

  metal(color = 0x8892a0) {
    return cached('metal' + color, () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.9 }));
  },

  paintedMetal(color) {
    return cached('painted' + color, () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.5 }));
  },

  warning() {
    // vallas de obra naranja/blanco
    return cached('warning', () =>
      new THREE.MeshStandardMaterial({ color: 0xe8791a, roughness: 0.6, metalness: 0.1 }));
  },

  waterTank() {
    return cached('waterTank', () =>
      new THREE.MeshStandardMaterial({ color: 0x2a4b8d, roughness: 0.7, metalness: 0.1 }));
  },

  foliage() {
    return cached('foliage', () =>
      new THREE.MeshStandardMaterial({ color: 0x3f6b34, roughness: 0.9, metalness: 0.0 }));
  }
};
