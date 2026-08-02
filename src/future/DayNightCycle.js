// =============================================================================
// DayNightCycle — ciclo día/noche ligado a la DISTANCIA recorrida.
// Cada `cycleDistance` metros el mundo transiciona gradualmente día -> noche ->
// día. Calcula un `nightFactor` (0 día, 1 medianoche) y lo reparte a todos los
// subsistemas: iluminación global, cielo/niebla/Ávila, faroles (pool de luces),
// emissive de ventanas/faros, y la policía (linternas + sirena).
// =============================================================================

import { CONFIG } from '../config.js';
import { Materials } from '../materials/Materials.js';

export class DayNightCycle {
  constructor(lighting, environment, nightLights) {
    this.lighting = lighting;
    this.environment = environment;
    this.nightLights = nightLights;
    this.police = null;         // lo asigna el Game si existe
    this.enabled = false;
    this.nightFactor = 0;
    this.phaseOffset = 0;       // 0 = empezar de día, 0.5 = empezar de noche
  }

  // Elegir en qué momento arranca el ciclo (día o noche).
  setStartMode(mode) { this.phaseOffset = mode === 'night' ? 0.5 : 0; }

  // nf a partir de la distancia: coseno suave -> transición gradual y cíclica.
  _computeNightFactor(distance) {
    const phase = (distance / CONFIG.night.cycleDistance + this.phaseOffset) % 1;
    const raw = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); // 0 -> 1 -> 0
    // ensanchar un poco los "mesetas" de día/noche
    return Math.pow(raw, 0.85);
  }

  update(dt, player) {
    if (!this.enabled) return;
    const nf = this._computeNightFactor(player.distance);
    this.nightFactor = nf;

    this.lighting.applyNight(nf);
    this.environment.applyNight(nf);
    this.nightLights.update(player.pos.x, player.pos.z, nf);
    Materials.setNight(nf);
    if (this.police && this.police.setNight) this.police.setNight(nf);
  }

  isNight() { return this.nightFactor > 0.5; }
}
