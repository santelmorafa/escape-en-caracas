import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// Player — controlador de tercera persona de MOVIMIENTO LIBRE.
// Ya no corre solo: se mueve con WASD relativo a hacia dónde mira la cámara
// (mouse). W adelante, S atrás, A/D lateral, F agacharse, SHIFT sprint, ESPACIO
// saltar. Colisiona SÓLIDO contra edificios/obstáculos (no los atraviesa).
//
// Estados: idle | run | jump | slide(agachado) | roll | dead | ledge
// =============================================================================

const STATE = { IDLE: 'idle', RUN: 'run', JUMP: 'jump', SLIDE: 'slide', ROLL: 'roll', DEAD: 'dead', LEDGE: 'ledge' };

export class Player {
  constructor(anim) {
    this.anim = anim;
    this.object = anim.object3d;
    this.collision = null;            // lo asigna el Game

    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);   // vel.y para saltos
    this.velX = 0; this.velZ = 0;            // velocidad horizontal
    this.speed = 0;                          // magnitud horizontal (pasos/anim)
    this.state = STATE.IDLE;
    this.moving = false;
    this._faceYaw = Math.PI;                 // el modelo mira hacia -Z al inicio
    this._moveDirX = 0; this._moveDirZ = -1;

    this.onGround = true;
    this.crouching = false;
    this.height = CONFIG.player.standHeight;

    this.sprintActive = false;
    this.sprintTimer = 0;
    this.sprintCooldown = 0;
    this.rollTimer = 0;
    this.slideTimer = 0;
    this._prevCrouch = false;
    this.stumbleTimer = 0;
    this.stumbleCooldown = 0;
    this._ledgeCooldown = 0;

    this._events = [];
    this._stepPhase = 0;

    this.distance = 0;
    this.dead = false;

    this.anim.play('idle', 0.1);
  }

  _emit(name, data) { this._events.push({ name, data }); }
  drainEvents() { const e = this._events; this._events = []; return e; }

  get collisionBox() {
    const r = CONFIG.player.radius, h = this.height;
    return new THREE.Box3(
      new THREE.Vector3(this.pos.x - r, this.pos.y, this.pos.z - r),
      new THREE.Vector3(this.pos.x + r, this.pos.y + h, this.pos.z + r)
    );
  }

  update(dt, input, world, cameraYaw = 0) {
    if (this.dead) { this._updateVisual(dt); return; }
    if (this.state === STATE.LEDGE) { this._updateLedge(dt); return; }

    if (this.stumbleTimer > 0) this.stumbleTimer -= dt;
    if (this.stumbleCooldown > 0) this.stumbleCooldown -= dt;
    if (this._ledgeCooldown > 0) this._ledgeCooldown -= dt;

    this._updateSprint(dt, input);

    // F mientras corres -> DESLIZARSE (slide temporizado). F quieto -> agacharse.
    const fEdge = input.state.crouch && !this._prevCrouch;
    if (fEdge && this.onGround && this.speed > 3 &&
        this.state !== STATE.SLIDE && this.state !== STATE.ROLL) {
      this._startSlide();
    }
    this._prevCrouch = input.state.crouch;

    this.crouching = input.state.crouch && this.onGround
      && this.state !== STATE.ROLL && this.state !== STATE.SLIDE;
    this.height = (this.state === STATE.ROLL || this.state === STATE.SLIDE)
      ? CONFIG.player.slideHeight
      : (this.crouching ? CONFIG.player.slideHeight : CONFIG.player.standHeight);

    this._updateVertical(dt, input, world);
    this._updateMove(dt, input, cameraYaw);
    if (this.state === STATE.ROLL) { this.rollTimer -= dt; if (this.rollTimer <= 0) this._setState(this.moving ? STATE.RUN : STATE.IDLE); }
    if (this.state === STATE.SLIDE) { this.slideTimer -= dt; if (this.slideTimer <= 0) this._setState(this.moving ? STATE.RUN : STATE.IDLE); }
    this._updateAnimState();

    this.distance = Math.max(this.distance, Math.hypot(this.pos.x, this.pos.z));

    if (this.onGround && this.speed > 2 && (this.state === STATE.RUN || this.state === STATE.SLIDE)) {
      this._stepPhase += this.speed * dt;
      const stride = CONFIG.audio.strideLength;
      if (this._stepPhase >= stride) { this._stepPhase -= stride; this._emit('step'); }
    }

    this._syncObject();
    this._updateVisual(dt);
  }

  _updateSprint(dt, input) {
    if (this.sprintCooldown > 0) this.sprintCooldown = Math.max(0, this.sprintCooldown - dt);
    if (input.state.sprint && this.sprintTimer > 0 && this.sprintCooldown === 0 && this.moving) {
      this.sprintActive = true;
      this.sprintTimer = Math.max(0, this.sprintTimer - dt);
      if (this.sprintTimer === 0) { this.sprintActive = false; this.sprintCooldown = CONFIG.sprint.cooldown; }
    } else {
      this.sprintActive = false;
    }
    if (!this.sprintActive && this.sprintCooldown === 0) {
      this.sprintTimer = Math.min(CONFIG.sprint.duration,
        this.sprintTimer + dt * (CONFIG.sprint.duration / (CONFIG.sprint.cooldown || 1)));
    }
  }

  // Movimiento horizontal relativo a la cámara + colisión sólida (resbala).
  _updateMove(dt, input, cameraYaw) {
    const F = CONFIG.freeMove;

    // deslizándose: mantiene el impulso hacia adelante en la dirección del modelo
    if (this.state === STATE.SLIDE) {
      const base = F.walkSpeed * CONFIG.player.slideSpeedBoost;
      const tvx = this._moveDirX * base, tvz = this._moveDirZ * base;
      const a = Math.min(1, F.accel * dt);
      this.velX += (tvx - this.velX) * a;
      this.velZ += (tvz - this.velZ) * a;
      this.moving = true;
      let nx = this.pos.x + this.velX * dt, nz = this.pos.z + this.velZ * dt;
      if (this.collision) {
        const r = this.collision.resolveHorizontal(this.pos, nx, nz, this.height, CONFIG.player.radius);
        if (Math.abs(r.x - nx) > 1e-4) this.velX = 0;
        if (Math.abs(r.z - nz) > 1e-4) this.velZ = 0;
        nx = r.x; nz = r.z;
      }
      this.pos.x = nx; this.pos.z = nz;
      this.speed = Math.hypot(this.velX, this.velZ);
      return;
    }

    const ix = (input.state.right ? 1 : 0) - (input.state.left ? 1 : 0);
    const iz = (input.state.forward ? 1 : 0) - (input.state.back ? 1 : 0);
    const sinY = Math.sin(cameraYaw), cosY = Math.cos(cameraYaw);
    // forward = (sinY,0,-cosY); right = (cosY,0,sinY)
    let dx = cosY * ix + sinY * iz;
    let dz = sinY * ix - cosY * iz;
    const len = Math.hypot(dx, dz);

    let tvx = 0, tvz = 0;
    if (len > 0.001) {
      dx /= len; dz /= len;
      let base = (iz < 0 && ix === 0) ? F.backSpeed : F.walkSpeed;
      if (this.sprintActive) base *= F.sprintMultiplier;
      if (this.crouching) base *= 0.55;      // agachado va más lento
      tvx = dx * base; tvz = dz * base;
      this._moveDirX = dx; this._moveDirZ = dz;
      this.moving = true;
    } else {
      this.moving = false;
    }

    const a = Math.min(1, F.accel * dt);
    this.velX += (tvx - this.velX) * a;
    this.velZ += (tvz - this.velZ) * a;

    let nx = this.pos.x + this.velX * dt;
    let nz = this.pos.z + this.velZ * dt;
    if (this.collision) {
      const r = this.collision.resolveHorizontal(this.pos, nx, nz, this.height, CONFIG.player.radius);
      if (Math.abs(r.x - nx) > 1e-4) this.velX = 0;
      if (Math.abs(r.z - nz) > 1e-4) this.velZ = 0;
      nx = r.x; nz = r.z;
    }
    this.pos.x = nx; this.pos.z = nz;
    this.speed = Math.hypot(this.velX, this.velZ);

    if (this.moving) {
      const targetYaw = Math.atan2(this._moveDirX, this._moveDirZ);
      this._faceYaw = this._lerpAngle(this._faceYaw, targetYaw, F.turnLerp);
    }
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  _updateVertical(dt, input, world) {
    const P = CONFIG.player;

    if (this.onGround && input.consume('jump')) {
      this.vel.y = P.jumpVelocity;
      this.onGround = false;
      this._setState(STATE.JUMP);
      this._emit('jump');
    }

    const step = this.onGround ? P.stepHeight : 0;
    const surf = world ? world.surfaceHeightAt(this.pos.x, this.pos.z, this.pos.y, step) : 0;

    if (!this.onGround) {
      this.vel.y += P.gravity * dt;
      this.pos.y += this.vel.y * dt;
      if (surf !== null && this.vel.y <= 0 && this.pos.y <= surf) {
        const impact = this.vel.y;
        this.pos.y = surf; this.vel.y = 0; this.onGround = true;
        if (impact <= P.hardLandingVy) { this._startRoll(); this._emit('roll'); }
        else if (impact < -5) this._emit('land');
      }
    } else {
      if (surf === null) { this.onGround = false; this.vel.y = 0; }
      else if (surf > this.pos.y + 0.02 && surf <= this.pos.y + P.stepHeight) this.pos.y = surf;
      else if (Math.abs(surf - this.pos.y) <= 0.06) this.pos.y = surf;
      else { this.onGround = false; this.vel.y = 0; }
    }
  }

  _updateAnimState() {
    if (this.state === STATE.DEAD || this.state === STATE.LEDGE
      || this.state === STATE.ROLL || this.state === STATE.SLIDE) return;
    if (!this.onGround) { this._setState(STATE.JUMP); return; }
    if (this.crouching) { this._setState(STATE.SLIDE); return; }
    this._setState(this.moving ? STATE.RUN : STATE.IDLE);
  }

  _startSlide() {
    this._setState(STATE.SLIDE);
    this.slideTimer = CONFIG.player.slideDuration;
    this._emit('slide');
  }

  _startRoll() {
    this._setState(STATE.ROLL);
    this.rollTimer = CONFIG.player.rollDuration;
  }

  _setState(next) {
    if (this.state === next) return;
    this.state = next;
    switch (next) {
      case STATE.IDLE: this.anim.play('idle'); break;
      case STATE.RUN: this.anim.play('run'); break;
      case STATE.JUMP: this.anim.play('jump'); break;
      case STATE.SLIDE: this.anim.play('slide'); break;
      case STATE.ROLL: this.anim.play('roll'); break;
      case STATE.DEAD: this.anim.play('death'); break;
    }
  }

  // ---- agarre de bordes ----
  canGrabLedge() {
    return !this.dead && !this.onGround && this.state !== STATE.LEDGE
      && this._ledgeCooldown <= 0 && this.vel.y < 1.0;
  }

  grabLedge(t) {
    if (this.state === STATE.LEDGE) return;
    const LG = CONFIG.ledgeGrab;
    this.state = STATE.LEDGE;
    this.onGround = false;
    this.vel.set(0, 0, 0); this.velX = 0; this.velZ = 0; this.speed = 0;
    this.ledgeTop = t.top;
    this._hangX = t.hangX; this._hangZ = t.hangZ;
    this._standX = t.standX; this._standZ = t.standZ;
    this.pos.set(t.hangX, t.top - LG.hangDrop, t.hangZ);
    this._hangY = this.pos.y;
    this.height = CONFIG.player.standHeight;
    this._ledgePhase = 'hang';
    this._ledgeTimer = LG.hangDuration;
    this.anim.play(this.anim.hasRealClip('ledge') ? 'ledge' : 'idle', 0.1);
    this._syncObject();
  }

  _updateLedge(dt) {
    const LG = CONFIG.ledgeGrab;
    this._ledgeTimer -= dt;
    if (this._ledgePhase === 'hang') {
      if (this._ledgeTimer <= 0) {
        this._ledgePhase = 'climb';
        this._ledgeTimer = LG.climbDuration;
        this.anim.play(this.anim.hasRealClip('climb') ? 'climb' : 'run', 0.1);
      }
    } else {
      const t = 1 - Math.max(0, this._ledgeTimer) / LG.climbDuration;
      const e = t * t * (3 - 2 * t);
      this.pos.y = THREE.MathUtils.lerp(this._hangY, this.ledgeTop, e);
      this.pos.x = THREE.MathUtils.lerp(this._hangX, this._standX, e);
      this.pos.z = THREE.MathUtils.lerp(this._hangZ, this._standZ, e);
      if (this._ledgeTimer <= 0) {
        this.pos.set(this._standX, this.ledgeTop, this._standZ);
        this.onGround = true; this.state = STATE.IDLE;
        this.velX = 0; this.velZ = 0; this.speed = 0;
        this._ledgeCooldown = LG.cooldown;
        this.anim.play('idle', 0.12);
      }
    }
    this.distance = Math.max(this.distance, Math.hypot(this.pos.x, this.pos.z));
    this._syncObject();
    this._updateVisual(dt);
  }

  stumble() { return false; }   // (compat: los sólidos ya bloquean el paso)

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.velX = 0; this.velZ = 0; this.speed = 0;
    this._setState(STATE.DEAD);
  }

  respawn(checkpoint) {
    this.dead = false;
    this.pos.set(checkpoint.x ?? 0, checkpoint.y ?? 0, checkpoint.z ?? 0);
    this.vel.set(0, 0, 0); this.velX = 0; this.velZ = 0; this.speed = 0;
    this.onGround = true; this.crouching = false; this._prevCrouch = false;
    this.height = CONFIG.player.standHeight;
    this.state = STATE.IDLE;
    this._faceYaw = Math.PI;
    this.sprintTimer = CONFIG.sprint.duration;
    this.sprintCooldown = 0;
    this.stumbleTimer = 0; this.stumbleCooldown = 0; this._ledgeCooldown = 0;
    this.distance = Math.max(0, checkpoint.distance ?? 0);
    this.anim.resetPose();
    this.anim.play('idle', 0.05);   // arrancar en reposo (no corriendo)
    this._syncObject();
  }

  _syncObject() {
    this.object.position.copy(this.pos);
    // faceOffset corrige la orientación del modelo para que mire al frente
    // (en la dirección del movimiento), no de espaldas.
    this.object.rotation.y = this._faceYaw + CONFIG.character.faceOffset;
  }

  _updateVisual(dt) { this.anim.update(dt); }
}

export { STATE };
