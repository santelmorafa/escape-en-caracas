import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Materials } from '../materials/Materials.js';
import { Tile } from './Tile.js';

// =============================================================================
// CityGrid — mundo de CIUDAD ABIERTA en rejilla 2D. Mantiene un pool de manzanas
// (Tile) alrededor del jugador y las recicla al cruzar de manzana. Hay calles en
// X y Z (giras donde quieras, hay varias rutas) y edificios sólidos y climbables.
// Provee las consultas espaciales que usan el jugador, la colisión y la policía.
// =============================================================================

const C = CONFIG.city;

export class CityGrid {
  constructor(scene) {
    this.scene = scene;
    this.R = C.gridRadius;
    const n = (2 * this.R + 1) * (2 * this.R + 1);
    this.pool = []; this.free = []; this.active = new Map();
    for (let i = 0; i < n; i++) { const t = new Tile(scene); t.deactivate(); this.pool.push(t); this.free.push(t); }

    // suelo grande que sigue al jugador (calzada continua)
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800, 1, 1), Materials.ground());
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    this._pi = null; this._pj = null;
    this._lastLandmarkKey = null;
  }

  init() { this.update(0, 0, true); }

  update(px, pz, force = false) {
    this.ground.position.set(px, 0, pz);
    const pi = Math.floor(px / C.tileSize), pj = Math.floor(pz / C.tileSize);
    if (!force && pi === this._pi && pj === this._pj) return;
    this._pi = pi; this._pj = pj;

    const needed = new Set();
    for (let di = -this.R; di <= this.R; di++)
      for (let dj = -this.R; dj <= this.R; dj++) needed.add((pi + di) + ',' + (pj + dj));

    for (const [k, t] of this.active) {
      if (!needed.has(k)) { t.deactivate(); this.free.push(t); this.active.delete(k); }
    }
    for (const k of needed) {
      if (!this.active.has(k)) {
        const t = this.free.pop();
        if (!t) continue;
        const [gi, gj] = k.split(',').map(Number);
        t.generate(gi, gj);
        this.active.set(k, t);
      }
    }
  }

  _tileAt(x, z) {
    return this.active.get(Math.floor(x / C.tileSize) + ',' + Math.floor(z / C.tileSize)) || null;
  }

  // Colliders de las 9 manzanas alrededor del punto (correcto en los bordes).
  getNearbyColliders(x, z) {
    const pi = Math.floor(x / C.tileSize), pj = Math.floor(z / C.tileSize);
    const out = [];
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const t = this.active.get((pi + di) + ',' + (pj + dj));
        if (t) for (const c of t.colliders) out.push(c);
      }
    return out;
  }

  getNearbySurfaces(x, z) {
    const pi = Math.floor(x / C.tileSize), pj = Math.floor(z / C.tileSize);
    const out = [];
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const t = this.active.get((pi + di) + ',' + (pj + dj));
        if (t) for (const s of t.surfaces) out.push(s);
      }
    return out;
  }

  getNearbyLadders(x, z) {
    const pi = Math.floor(x / C.tileSize), pj = Math.floor(z / C.tileSize);
    const out = [];
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const t = this.active.get((pi + di) + ',' + (pj + dj));
        if (t) for (const l of t.ladders) out.push(l);
      }
    return out;
  }

  // Altura de la superficie transitable (suelo=0 o tope de edificio) en (x,z).
  surfaceHeightAt(x, z, feetY = 0, step = 0) {
    let best = 0;
    const reach = feetY + step + 0.001;
    const surfaces = this.getNearbySurfaces(x, z);
    for (const s of surfaces) {
      if (x < s.xMin || x > s.xMax || z < s.zMin || z > s.zMax) continue;
      if (s.top > reach) continue;
      if (s.top > best) best = s.top;
    }
    return best;
  }

  groundHeightAt() { return 0; }   // la calzada es continua (sin huecos)

  getApproachingLandmark(px, pz) {
    const key = Math.floor(px / C.tileSize) + ',' + Math.floor(pz / C.tileSize);
    const t = this.active.get(key);
    if (t && t.landmark && key !== this._lastLandmarkKey) {
      this._lastLandmarkKey = key;
      return { label: t.landmark.label };
    }
    if (!t || !t.landmark) { if (key !== this._lastLandmarkKey) this._lastLandmarkKey = null; }
    return null;
  }
}
