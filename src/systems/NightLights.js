import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// NightLights — charcos de luz cálida de los faroles en la ciudad, con un POOL
// fijo de PointLights (sin reventar el rendimiento). Los faroles están en las
// ESQUINAS de las manzanas (intersecciones de la rejilla); el pool se coloca en
// las intersecciones más cercanas al jugador. Ninguna proyecta sombras.
// =============================================================================

const N = CONFIG.night;
const T = CONFIG.city.tileSize;

export class NightLights {
  constructor(scene) {
    this.lights = [];
    for (let i = 0; i < N.maxLampLights; i++) {
      const l = new THREE.PointLight(N.lampColor, 0, N.lampDistance * 1.6, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this._active = false;
  }

  update(px, pz, nf) {
    if (nf < 0.02) {
      if (this._active) { for (const l of this.lights) l.intensity = 0; this._active = false; }
      return;
    }
    this._active = true;
    // intersección de rejilla más cercana
    const gi = Math.round(px / T), gj = Math.round(pz / T);
    // repartir el pool en las intersecciones cercanas (patrón en espiral simple)
    const offsets = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let i = 0; i < this.lights.length; i++) {
      const o = offsets[i % offsets.length];
      const x = (gi + o[0]) * T, z = (gj + o[1]) * T;
      const l = this.lights[i];
      l.position.set(x, N.lampHeight, z);
      l.intensity = N.lampIntensity * nf;
    }
  }
}
