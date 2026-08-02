import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// CameraSystem — cámara orbital en tercera persona controlada por el MOUSE.
// El mouse gira yaw/pitch; la cámara orbita alrededor del jugador. El `yaw` se
// expone para que el jugador se mueva relativo a hacia dónde miras.
// =============================================================================

export class CameraSystem {
  constructor(aspect) {
    const c = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, aspect, c.near, c.far);
    this.yaw = c.startYaw;
    this.pitch = 0.25;
    this._pos = new THREE.Vector3();
    this._pivot = new THREE.Vector3();
  }

  // Aplica el movimiento del mouse (deltas en px) a yaw/pitch.
  applyMouse(dx, dy) {
    const c = CONFIG.camera;
    this.yaw -= dx * c.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * c.sensitivity, c.minPitch, c.maxPitch);
  }

  // Dirección "hacia adelante" en el plano (para el movimiento del jugador).
  get forward() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  get right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  update(player, dt) {
    const c = CONFIG.camera;
    const p = player.pos;
    this._pivot.set(p.x, p.y + c.pivotHeight, p.z);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // detrás del jugador = -forward; se eleva con el pitch
    const behind = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const desired = new THREE.Vector3(
      this._pivot.x + behind.x * c.distance * cp,
      this._pivot.y + c.distance * sp,
      this._pivot.z + behind.z * c.distance * cp
    );
    const k = 1 - Math.pow(1 - c.followLerp, dt * 60);
    this._pos.lerp(desired, k);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._pivot);
  }

  onResize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  snapTo(player) {
    const c = CONFIG.camera;
    const p = player.pos;
    this._pivot.set(p.x, p.y + c.pivotHeight, p.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const behind = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this._pos.set(
      this._pivot.x + behind.x * c.distance * cp,
      this._pivot.y + c.distance * sp,
      this._pivot.z + behind.z * c.distance * cp
    );
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._pivot);
  }
}
