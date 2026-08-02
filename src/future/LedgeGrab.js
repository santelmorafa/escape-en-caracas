import { CONFIG } from '../config.js';

// =============================================================================
// LedgeGrab — agarre automático de bordes.
//
// Cuando el jugador salta hacia una azotea/plataforma y el salto se queda corto
// POR POCO, se agarra del canto (se cuelga) y trepa solo tras un instante. Si el
// salto se queda demasiado corto (fuera del rango), cae normalmente.
//
// "Justo": sólo agarra si (a) los pies quedan como mucho `reach` por debajo del
// borde (near-miss vertical) y (b) estás pegado al canto — a `outReach` por
// fuera o, si ya entraste, a `inReach` por dentro. Sólo cantos altos
// (`minLedgeHeight`), nunca bordillos. La física de colgarse/trepar vive en
// Player (STATE.LEDGE); aquí sólo se DETECTA y se dispara.
// =============================================================================

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class LedgeGrab {
  constructor(player, world) {
    this.player = player;
    this.world = world;
    this.enabled = false;
  }

  // Devuelve el objetivo de agarre {top,hangX,hangZ,standX,standZ} o null.
  tryGrab() {
    if (!this.enabled) return null;
    const p = this.player;
    if (!p.canGrabLedge()) return null;

    const LG = CONFIG.ledgeGrab;
    const feetY = p.pos.y, px = p.pos.x, pz = p.pos.z;

    const surfaces = this.world.getNearbySurfaces(pz, 6);
    let best = null, bestScore = Infinity;

    for (const s of surfaces) {
      if (s.top < LG.minLedgeHeight) continue;
      const dh = s.top - feetY;                       // cuánto por debajo del borde
      if (dh <= LG.minRise || dh > LG.reach) continue; // sólo near-miss vertical

      const cx = clamp(px, s.xMin, s.xMax);
      const cz = clamp(pz, s.zMin, s.zMax);
      const outDist = Math.hypot(px - cx, pz - cz);

      let ok = false;
      if (outDist > 0) {
        ok = outDist <= LG.outReach;                  // alcanzas el canto desde fuera
      } else {
        const inDist = Math.min(px - s.xMin, s.xMax - px, pz - s.zMin, s.zMax - pz);
        ok = inDist <= LG.inReach;                    // ya dentro pero junto al canto
      }
      if (!ok) continue;

      const score = outDist + dh * 0.3;               // prioriza el canto más cercano
      if (score < bestScore) { bestScore = score; best = this._target(s, px, pz); }
    }
    return best;
  }

  // Posición de cuelgue (en el canto) y de aterrizaje (sobre la plataforma).
  _target(s, px, pz) {
    const hangX = clamp(px, s.xMin, s.xMax);
    const hangZ = clamp(pz, s.zMin, s.zMax);
    // empujar hacia dentro desde el borde por el que se agarró
    let standX, standZ;
    if (px < s.xMin) standX = s.xMin + 0.6;
    else if (px > s.xMax) standX = s.xMax - 0.6;
    else standX = clamp(px, s.xMin + 0.4, s.xMax - 0.4);
    if (pz < s.zMin) standZ = s.zMin + 0.6;
    else if (pz > s.zMax) standZ = s.zMax - 0.6;
    else standZ = clamp(pz, s.zMin + 0.4, s.zMax - 0.4);
    return { top: s.top, hangX, hangZ, standX, standZ };
  }
}
