import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// NightLights — charcos de luz cálida de los faroles, SIN reventar el
// rendimiento. En vez de una luz por farol (cientos), mantiene un POOL fijo de
// PointLights (CONFIG.night.maxLampLights) que se reposiciona a las estaciones
// de farol más cercanas al jugador cada frame. Ninguna proyecta sombras.
//
// Los faroles están cada `lampSpacing` m (z = -10, -30, -50, …), en ambos
// lados; alternamos el lado por estación para repartir los charcos.
// =============================================================================

const N = CONFIG.night;

export class NightLights {
  constructor(scene) {
    this.scene = scene;
    this.lights = [];
    for (let i = 0; i < N.maxLampLights; i++) {
      const l = new THREE.PointLight(N.lampColor, 0, N.lampDistance, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this._active = false;
  }

  update(playerZ, playerX, nf) {
    if (nf < 0.02) {
      if (this._active) { for (const l of this.lights) l.intensity = 0; this._active = false; }
      return;
    }
    this._active = true;
    const spacing = N.lampSpacing;
    // estación central más cercana al jugador (z = -10 - 20k)
    const k0 = Math.round((-playerZ - 10) / spacing);
    const half = Math.floor(this.lights.length / 2);
    for (let i = 0; i < this.lights.length; i++) {
      const k = k0 - half + i;
      const z = -(10 + spacing * k);
      const side = (k % 2 === 0) ? -1 : 1;
      const l = this.lights[i];
      l.position.set(side * N.lampInset, N.lampHeight, z);
      l.intensity = N.lampIntensity * nf;
    }
  }
}
