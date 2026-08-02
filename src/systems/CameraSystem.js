import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// CameraSystem — cámara en tercera persona detrás y por encima del jugador,
// con suavizado (lerp) de posición y objetivo. Sigue el desplazamiento lateral
// de forma amortiguada para que el corredor se sienta vivo.
// =============================================================================

export class CameraSystem {
  constructor(aspect) {
    const c = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, aspect, c.near, c.far);
    this._pos = new THREE.Vector3(0, c.offset.y, c.offset.z);
    this._look = new THREE.Vector3(0, c.lookAtHeight, -10);
    this.camera.position.copy(this._pos);
  }

  update(player, dt) {
    const c = CONFIG.camera;
    const p = player.pos;

    // objetivo de posición: detrás (+z) y arriba, siguiendo X amortiguado
    const targetX = p.x * c.lateralFollow;
    const desired = new THREE.Vector3(
      targetX + c.offset.x,
      p.y + c.offset.y,
      p.z + c.offset.z
    );
    this._pos.lerp(desired, 1 - Math.pow(1 - c.positionLerp, dt * 60));
    this.camera.position.copy(this._pos);

    // objetivo de mirada: un poco adelante del jugador
    const lookDesired = new THREE.Vector3(
      p.x * c.lateralFollow * 0.6,
      p.y + c.lookAtHeight,
      p.z - 8
    );
    this._look.lerp(lookDesired, 1 - Math.pow(1 - c.lookLerp, dt * 60));
    this.camera.lookAt(this._look);
  }

  onResize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // snap inmediato (al reaparecer)
  snapTo(player) {
    const c = CONFIG.camera;
    this._pos.set(player.pos.x + c.offset.x, player.pos.y + c.offset.y, player.pos.z + c.offset.z);
    this._look.set(player.pos.x, player.pos.y + c.lookAtHeight, player.pos.z - 8);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
