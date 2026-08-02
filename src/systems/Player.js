import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// Player — física ligera y máquina de estados de movimiento.
// No usa motor físico: colisiones AABB simples (resueltas por CollisionSystem)
// y gravedad manual. Conduce al AnimationSystem según el estado.
//
// Estados: run | jump | slide | roll | dead
// =============================================================================

const STATE = { RUN: 'run', JUMP: 'jump', SLIDE: 'slide', ROLL: 'roll', DEAD: 'dead', LEDGE: 'ledge' };

export class Player {
  constructor(anim) {
    this.anim = anim;                 // AnimationSystem
    this.object = anim.object3d;      // THREE.Group

    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.speed = CONFIG.player.baseSpeed;  // avance actual (m/s)
    this.state = STATE.RUN;

    this.onGround = true;
    this.height = CONFIG.player.standHeight;

    // sprint
    this.sprintActive = false;
    this.sprintTimer = 0;      // tiempo restante de sprint
    this.sprintCooldown = 0;   // tiempo restante de recarga

    // slide
    this.slideTimer = 0;

    // roll
    this.rollTimer = 0;

    // tropiezo (chocar de lado con obstáculo: frena, no mata)
    this.stumbleTimer = 0;
    this.stumbleCooldown = 0;

    // agarre de bordes (ledge grab)
    this._ledgeCooldown = 0;

    // cola de eventos para audio/partículas ('step','jump','land','roll','slide')
    this._events = [];
    this._stepPhase = 0;

    this.distance = 0;         // metros recorridos (=-z)
    this.dead = false;

    this.anim.play('run', 0.1);
  }

  _emit(name, data) { this._events.push({ name, data }); }
  drainEvents() { const e = this._events; this._events = []; return e; }

  get collisionBox() {
    // AABB centrada en la posición, con altura según estado.
    const r = CONFIG.player.radius;
    const h = this.height;
    return new THREE.Box3(
      new THREE.Vector3(this.pos.x - r, this.pos.y, this.pos.z - r),
      new THREE.Vector3(this.pos.x + r, this.pos.y + h, this.pos.z + r)
    );
  }

  update(dt, input, world) {
    if (this.dead) { this._updateVisual(dt); return; }

    // agarrado a un borde: la maniobra maneja su propia física
    if (this.state === STATE.LEDGE) { this._updateLedge(dt); return; }

    if (this.stumbleTimer > 0) this.stumbleTimer -= dt;
    if (this.stumbleCooldown > 0) this.stumbleCooldown -= dt;
    if (this._ledgeCooldown > 0) this._ledgeCooldown -= dt;

    this._updateSprint(dt, input);
    this._updateForward(dt, input);
    this._updateLateral(dt, input);
    this._updateVertical(dt, input, world);
    this._updateStateTimers(dt);

    // avance
    this.pos.z -= this.speed * dt;   // -z es "hacia adelante"
    this.distance = Math.max(this.distance, -this.pos.z);

    // pisadas: emitir un paso cada `strideLength` metros corriendo por el suelo
    if (this.onGround && this.speed > 2 && (this.state === STATE.RUN || this.state === STATE.SLIDE)) {
      this._stepPhase += this.speed * dt;
      const stride = CONFIG.audio.strideLength;
      if (this._stepPhase >= stride) { this._stepPhase -= stride; this._emit('step'); }
    }

    this._syncObject();
    this._updateVisual(dt);
  }

  _updateSprint(dt, input) {
    if (this.sprintCooldown > 0) {
      this.sprintCooldown = Math.max(0, this.sprintCooldown - dt);
    }
    const wants = input.state.sprint && this.sprintCooldown === 0 && this.sprintTimer > 0;
    if (input.state.sprint && this.sprintCooldown === 0) {
      if (this.sprintTimer <= 0 && !this.sprintActive && this._sprintReady !== false) {
        // arrancar sprint
      }
    }
    // Modelo simple: mantener Shift consume sprintTimer; al agotarse entra cooldown.
    if (input.state.sprint && this.sprintTimer > 0 && this.sprintCooldown === 0) {
      this.sprintActive = true;
      this.sprintTimer = Math.max(0, this.sprintTimer - dt);
      if (this.sprintTimer === 0) {
        this.sprintActive = false;
        this.sprintCooldown = CONFIG.sprint.cooldown;
      }
    } else {
      this.sprintActive = false;
    }
    // recargar sprintTimer sólo cuando no hay cooldown y no se está usando
    if (!this.sprintActive && this.sprintCooldown === 0) {
      this.sprintTimer = Math.min(CONFIG.sprint.duration,
        this.sprintTimer + dt * (CONFIG.sprint.duration / (CONFIG.sprint.cooldown || 1)));
    }
  }

  _updateForward(dt, input) {
    const P = CONFIG.player;
    let target = P.baseSpeed;
    if (input.state.forward) target = P.maxSpeed;
    if (this.state === STATE.SLIDE) target *= P.slideSpeedBoost;
    if (this.sprintActive) target *= CONFIG.sprint.multiplier;
    target = THREE.MathUtils.clamp(target, P.minSpeed, P.maxSpeed * CONFIG.sprint.multiplier);

    // tras un tropiezo, la velocidad queda limitada mientras te recuperas
    if (this.stumbleTimer > 0) target = Math.min(target, P.stumbleSpeed);

    const rate = target > this.speed ? P.accel : P.decel;
    this.speed += (target - this.speed) * Math.min(1, rate * dt);
  }

  _updateLateral(dt, input) {
    const P = CONFIG.player;
    let dir = 0;
    if (input.state.left) dir -= 1;
    if (input.state.right) dir += 1;
    this.pos.x += dir * P.lateralSpeed * dt;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -P.corridorHalfWidth, P.corridorHalfWidth);
  }

  _updateVertical(dt, input, world) {
    const P = CONFIG.player;

    // saltar
    if (this.onGround && input.consume('jump') && this.state !== STATE.SLIDE) {
      this.vel.y = P.jumpVelocity;
      this.onGround = false;
      this._setState(STATE.JUMP);
      this._emit('jump');
    }

    // agacharse / deslizar
    if (this.onGround && input.state.crouch && this.state === STATE.RUN) {
      this._startSlide();
    }

    // superficie bajo los pies. En el aire toleramos 0 (aterrizas al cruzar el
    // tope); en el suelo toleramos stepHeight (subes bordillos/gradas a techos).
    const step = this.onGround ? P.stepHeight : 0;
    const surf = world ? world.surfaceHeightAt(this.pos.x, this.pos.z, this.pos.y, step) : 0;

    if (!this.onGround) {
      this.vel.y += P.gravity * dt;
      this.pos.y += this.vel.y * dt;

      if (surf !== null && this.vel.y <= 0 && this.pos.y <= surf) {
        const impact = this.vel.y;
        this.pos.y = surf;
        this.vel.y = 0;
        this.onGround = true;
        if (impact <= P.hardLandingVy) { this._startRoll(); this._emit('roll'); }
        else { if (this.state === STATE.JUMP) this._setState(STATE.RUN); if (impact < -5) this._emit('land'); }
      }
      // surf === null -> vacío/hueco: seguimos cayendo (muerte la marca el Game)
    } else {
      if (surf === null) {
        this.onGround = false;      // te saliste sobre un hueco
        this.vel.y = 0;
      } else if (surf > this.pos.y + 0.02 && surf <= this.pos.y + P.stepHeight) {
        this.pos.y = surf;          // subir un escalón bajo
      } else if (Math.abs(surf - this.pos.y) <= 0.06) {
        this.pos.y = surf;          // caminar sobre la superficie
      } else {
        this.onGround = false;      // te saliste de un borde: empieza a caer
        this.vel.y = 0;
      }
    }
  }

  _updateStateTimers(dt) {
    if (this.state === STATE.SLIDE) {
      this.slideTimer -= dt;
      this.height = CONFIG.player.slideHeight;
      if (this.slideTimer <= 0) {
        this.height = CONFIG.player.standHeight;
        this._setState(STATE.RUN);
      }
    } else if (this.state === STATE.ROLL) {
      this.rollTimer -= dt;
      this.height = CONFIG.player.slideHeight * 1.1;
      if (this.rollTimer <= 0) {
        this.height = CONFIG.player.standHeight;
        this._setState(STATE.RUN);
      }
    } else {
      this.height = CONFIG.player.standHeight;
    }
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
      case STATE.RUN: this.anim.play('run'); break;
      case STATE.JUMP: this.anim.play('jump'); break;
      case STATE.SLIDE: this.anim.play('slide'); break;
      case STATE.ROLL: this.anim.play('roll'); break;
      case STATE.DEAD: this.anim.play('death'); break;
    }
  }

  // ¿Puede intentar agarrarse de un borde ahora? (en el aire, descendiendo)
  canGrabLedge() {
    return !this.dead && !this.onGround && this.state !== STATE.LEDGE
      && this._ledgeCooldown <= 0 && this.vel.y < 1.0;
  }

  // Iniciar el agarre: colgarse del borde y luego trepar solo.
  grabLedge(t) {
    if (this.state === STATE.LEDGE) return;
    const LG = CONFIG.ledgeGrab;
    this.state = STATE.LEDGE;
    this.onGround = false;
    this.vel.set(0, 0, 0);
    this.speed = 0;
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
    } else { // climb: izarse suavemente hasta quedar de pie sobre el borde
      const t = 1 - Math.max(0, this._ledgeTimer) / LG.climbDuration;
      const e = t * t * (3 - 2 * t); // smoothstep
      this.pos.y = THREE.MathUtils.lerp(this._hangY, this.ledgeTop, e);
      this.pos.x = THREE.MathUtils.lerp(this._hangX, this._standX, e);
      this.pos.z = THREE.MathUtils.lerp(this._hangZ, this._standZ, e);
      if (this._ledgeTimer <= 0) {
        this.pos.set(this._standX, this.ledgeTop, this._standZ);
        this.onGround = true;
        this.state = STATE.RUN;
        this.speed = CONFIG.player.baseSpeed;
        this._ledgeCooldown = LG.cooldown;
        this.anim.play('run', 0.12);
      }
    }
    this.distance = Math.max(this.distance, -this.pos.z);
    this._syncObject();
    this._updateVisual(dt);
  }

  // Tropiezo al chocar de lado con un obstáculo: te frena en seco (la policía
  // aprovecha para acercarse). Devuelve true si de verdad tropezaste.
  stumble() {
    if (this.stumbleCooldown > 0 || this.dead) return false;
    this.speed = Math.min(this.speed, CONFIG.player.stumbleSpeed);
    this.stumbleTimer = CONFIG.player.stumbleDuration;
    this.stumbleCooldown = CONFIG.player.stumbleCooldown;
    return true;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.speed = 0;
    this._setState(STATE.DEAD);
  }

  respawn(checkpoint) {
    this.dead = false;
    this.pos.set(0, checkpoint.y ?? 0, checkpoint.z);
    this.vel.set(0, 0, 0);
    this.speed = CONFIG.player.baseSpeed;
    this.onGround = true;
    this.height = CONFIG.player.standHeight;
    this.state = STATE.RUN;
    this.sprintTimer = CONFIG.sprint.duration;
    this.sprintCooldown = 0;
    this.stumbleTimer = 0;
    this.stumbleCooldown = 0;
    this._ledgeCooldown = 0;
    this.distance = Math.max(0, checkpoint.distance ?? 0);
    this.anim.resetPose();
    this._syncObject();
  }

  _syncObject() {
    this.object.position.copy(this.pos);
    // el modelo mira hacia -z (hacia adelante). Soldier.glb mira +z por defecto,
    // se corrige orientando el group 180°.
    this.object.rotation.y = Math.PI;
  }

  _updateVisual(dt) {
    this.anim.update(dt);
  }
}

export { STATE };
