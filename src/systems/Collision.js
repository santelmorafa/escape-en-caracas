import { CONFIG } from '../config.js';

// =============================================================================
// CollisionSystem — colisiones AABB contra los obstáculos cercanos.
// Interpreta el `pass` de cada obstáculo:
//   'over'   -> chocas si vas por el suelo y no lo saltaste (puedes subirte)
//   'under'  -> chocas si tu cabeza pega en la barra (hay que deslizarse)
//   'around' -> chocas si vas por el suelo contra su lateral (puedes saltar
//               encima y quedarte en el techo: en el aire no hay choque lateral)
// Chocar YA NO mata: devuelve el impacto para que el Game lo trate como
// TROPIEZO (frena y acerca a la policía). Morir es caer a un hueco (lo ve Game).
// =============================================================================

const MARGIN = 0.14;  // tolerancia para no penalizar por roces mínimos

export class CollisionSystem {
  constructor(world) {
    this.world = world;
  }

  check(player) {
    const pb = player.collisionBox;
    const pxMin = pb.min.x + MARGIN, pxMax = pb.max.x - MARGIN;
    const pzMin = pb.min.z + MARGIN, pzMax = pb.max.z - MARGIN;
    const feet = player.pos.y;
    const head = player.pos.y + player.height;

    const near = this.world.getNearbyColliders(player.pos.z, 20);
    for (const c of near) {
      const b = c.box;
      if (pxMax < b.min.x || pxMin > b.max.x) continue;
      if (pzMax < b.min.z || pzMin > b.max.z) continue;

      switch (c.pass) {
        case 'under':
          // pegas con la cabeza en la barra alta (saltar no ayuda: hay que agacharse)
          if (head > b.min.y + MARGIN && feet < b.max.y - MARGIN) return this._hit(c);
          break;
        case 'over':
        case 'around':
        default:
          // sólido: sólo cuenta si vas por el SUELO contra el lateral. En el aire
          // no hay choque lateral -> puedes saltar y caer encima (subir a techos).
          if (player.onGround && feet < b.max.y - MARGIN) return this._hit(c);
          break;
      }
    }
    return null;
  }

  _hit(collider) {
    return { pass: collider.pass };
  }
}
