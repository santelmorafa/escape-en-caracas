import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { AnimationSystem } from '../systems/AnimationSystem.js';
import { Materials } from '../materials/Materials.js';

// =============================================================================
// Police — persecución en 3D REAL. Cada policía (modelo humano riggeado clonado,
// uniforme azul + gorra) tiene su propia posición y persigue la posición del
// jugador. Te ATRAPA al entrar en captureRadius. Como son entidades reales, se
// ven en pantalla (mira alrededor con el mouse para ubicarlos).
//
// De NOCHE: cada policía apunta su LINTERNA (SpotLight) hacia ti; si te giras a
// mirarlos de cerca, deslumbra. Una PATRULLA con SIRENA roja/azul los acompaña.
// =============================================================================

const POL = CONFIG.police;
const N = CONFIG.night;

const X_OFFSETS = [0, -1, 1, -2];
const DEPTH_OFFSETS = [0, 1.2, 2.0, 3.0];

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 14);

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.units = [];
    this.enabled = false;
    this.caught = false;
    this.onCaught = null;

    this.proximity = 0;
    this.nearestDist = Infinity;
    this.activeCount = Math.min(2, POL.maxCount);

    this.nightFactor = 0;
    this.dazzle = 0;
    this._t = 0;
    this._px = 0; this._pz = 0;
    this.patrol = null;
    this._nearestUnit = null;
  }

  async load(assetLoader) {
    for (let i = 0; i < POL.maxCount; i++) {
      const anim = new AnimationSystem(assetLoader, { uniform: POL.uniform, cap: true, capColor: POL.cap });
      await anim.load();
      const root = anim.object3d;
      root.visible = false;
      this.scene.add(root);
      anim.play('run', 0.1);

      let flashlight = null, flashTarget = null;
      if (i < N.maxFlashlights) {
        flashlight = new THREE.SpotLight(N.flashlightColor, 0, N.flashlightDistance, N.flashlightAngle, N.flashlightPenumbra, 2);
        flashlight.castShadow = false;
        flashTarget = new THREE.Object3D();
        this.scene.add(flashlight); this.scene.add(flashTarget);
        flashlight.target = flashTarget;
      }

      this.units.push({
        anim, root, flashlight, flashTarget,
        pos: new THREE.Vector3(), spawned: false,
        xOff: X_OFFSETS[i] * POL.formationSpread,
        depthOff: DEPTH_OFFSETS[i] * POL.formationDepth
      });
    }
    this._buildPatrol();
    return this;
  }

  spawn() {}

  _buildPatrol() {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.4, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.5, metalness: 0.4 });
    const part = (mat, sx, sy, sz, px, py, pz) => {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(sx, sy, sz); m.position.set(px, py, pz);
      m.castShadow = true; g.add(m); return m;
    };
    const L = 4.6, W = 1.9;
    part(white, W, 0.7, L, 0, 0.6, 0);
    part(dark, W * 0.6, 0.35, L, 0, 0.62, 0);
    part(white, W * 0.92, 0.6, L * 0.5, 0, 1.15, -0.1);
    part(Materials.glassDark(), W * 0.94, 0.5, L * 0.5 - 0.05, 0, 1.16, -0.1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, Materials.rubber());
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * (W / 2 - 0.05), 0.35, sz * (L / 2 - 0.9));
      g.add(w);
    }
    for (const sx of [-1, 1]) part(Materials.headlight(), 0.35, 0.22, 0.1, sx * W * 0.32, 0.75, -L / 2 + 0.02);
    this._sirenRedMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1a1a, emissiveIntensity: 0 });
    this._sirenBlueMat = new THREE.MeshStandardMaterial({ color: 0x00073a, emissive: 0x1a4dff, emissiveIntensity: 0 });
    part(this._sirenRedMat, 0.42, 0.18, 0.5, -0.3, 1.52, -0.1);
    part(this._sirenBlueMat, 0.42, 0.18, 0.5, 0.3, 1.52, -0.1);
    part(dark, 0.95, 0.06, 0.55, 0, 1.44, -0.1);
    this._sirenRed = new THREE.PointLight(0xff2222, 0, N.sirenDistance, 2);
    this._sirenBlue = new THREE.PointLight(0x3366ff, 0, N.sirenDistance, 2);
    this._sirenRed.castShadow = this._sirenBlue.castShadow = false;
    this._sirenRed.position.set(-0.3, 1.7, -0.1);
    this._sirenBlue.position.set(0.3, 1.7, -0.1);
    g.add(this._sirenRed); g.add(this._sirenBlue);
    g.visible = false;
    this.scene.add(g);
    this.patrol = g;
  }

  setNight(nf) { this.nightFactor = nf; }
  _difficulty(distance) { return THREE.MathUtils.clamp(distance / CONFIG.difficulty.rampDistance, 0, 1); }

  _spawnUnit(u, i, player) {
    // aparecen en distintas direcciones alrededor del jugador (calles distintas),
    // así se ven venir por varios lados de la ciudad.
    const ang = (i / Math.max(1, this.activeCount)) * Math.PI * 2 + (player.pos.x * 0.13 + player.pos.z * 0.07);
    const r = POL.spawnGap + u.depthOff;
    u.pos.set(player.pos.x + Math.sin(ang) * r, 0, player.pos.z + Math.cos(ang) * r);
    u.root.position.copy(u.pos);
    u.spawned = true;
  }

  update(dt, player, cameraYaw = 0) {
    if (!this.enabled || this.units.length === 0) return;
    this._t += dt;
    this._px = player.pos.x; this._pz = player.pos.z;

    if (player.dead) {
      for (const u of this.units) u.anim.update(dt);
      this._updateNightFX(player, cameraYaw, true);
      return;
    }

    this._lastDistance = player.distance;
    const D = this._difficulty(player.distance);
    const speed = POL.baseSpeed + CONFIG.difficulty.policeSpeedGain * D;
    this.activeCount = THREE.MathUtils.clamp(
      2 + Math.floor(player.distance / CONFIG.difficulty.extraCopEvery), 2, POL.maxCount);

    let nearest = Infinity, nearestUnit = null;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      const active = i < this.activeCount;
      u.root.visible = active;
      if (!active) { u.spawned = false; continue; }
      if (!u.spawned) this._spawnUnit(u, i, player);

      const dxp = player.pos.x - u.pos.x, dzp = player.pos.z - u.pos.z;
      const d = Math.hypot(dxp, dzp);
      if (d > 0.001) { u.pos.x += (dxp / d) * speed * dt; u.pos.z += (dzp / d) * speed * dt; }
      const gy = this.world.groundHeightAt(u.pos.x, u.pos.z);
      u.pos.y = gy === null ? 0 : gy;
      u.root.position.copy(u.pos);
      u.root.rotation.y = Math.atan2(dxp, dzp); // mirar al jugador

      if (d < nearest) { nearest = d; nearestUnit = u; }
      if (d <= POL.captureRadius && !this.caught) {
        this.caught = true;
        u.anim.play('capture', 0.12);
        if (this.onCaught) this.onCaught();
      } else if (!this.caught) {
        u.anim.play('run');
      }
      u.anim.update(dt);
    }

    this.nearestDist = nearest;
    this._nearestUnit = nearestUnit;
    this.proximity = 1 - THREE.MathUtils.clamp(
      (nearest - POL.captureRadius) / (POL.proxRange - POL.captureRadius), 0, 1);

    this._updateNightFX(player, cameraYaw, false);
  }

  _updateNightFX(player, cameraYaw, frozen) {
    const nf = this.nightFactor;
    let dazzle = 0;
    const camFx = Math.sin(cameraYaw), camFz = -Math.cos(cameraYaw);

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.flashlight) continue;
      const on = i < this.activeCount && u.spawned && nf > 0.02;
      u.flashlight.intensity = on ? N.flashlightIntensity * nf : 0;
      if (!on) continue;
      u.flashlight.position.set(u.pos.x, 1.5, u.pos.z);
      u.flashTarget.position.set(player.pos.x, 0.6, player.pos.z);
      u.flashTarget.updateMatrixWorld();

      // deslumbra si te giras a mirar de frente a un policía cercano
      const dxp = u.pos.x - player.pos.x, dzp = u.pos.z - player.pos.z;
      const d = Math.hypot(dxp, dzp) || 1;
      const dot = (camFx * dxp + camFz * dzp) / d;
      const inView = THREE.MathUtils.clamp((dot - 0.5) / 0.5, 0, 1);
      const near = THREE.MathUtils.clamp(1 - d / N.flashlightDistance, 0, 1);
      dazzle = Math.max(dazzle, inView * near);
    }
    this.dazzle = frozen ? this.dazzle : dazzle * nf;

    if (this.patrol) {
      this.patrol.visible = this.activeCount > 0 && !!this._nearestUnit;
      const nu = this._nearestUnit;
      if (nu) {
        const dx = nu.pos.x - player.pos.x, dz = nu.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        this.patrol.position.set(nu.pos.x + (dx / d) * 7, 0, nu.pos.z + (dz / d) * 7);
        this.patrol.rotation.y = Math.atan2(player.pos.x - this.patrol.position.x, player.pos.z - this.patrol.position.z);
      }
      const phase = Math.floor(this._t * N.sirenHz) % 2 === 0;
      const boost = 0.35 + 0.65 * nf;
      this._sirenRedMat.emissiveIntensity = phase ? 2.4 : 0.15;
      this._sirenBlueMat.emissiveIntensity = phase ? 0.15 : 2.4;
      this._sirenRed.intensity = (phase ? N.sirenIntensity : 0) * boost;
      this._sirenBlue.intensity = (phase ? 0 : N.sirenIntensity) * boost;
    }
  }

  onPlayerStumble() {}

  // Posiciones de los policías en el espacio de la CÁMARA para el radar.
  radarUnits(cameraYaw = 0) {
    const out = [];
    const sinY = Math.sin(cameraYaw), cosY = Math.cos(cameraYaw);
    for (let i = 0; i < this.activeCount && i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.spawned) continue;
      const rx = u.pos.x - this._px, rz = u.pos.z - this._pz;
      const forwardComp = rx * sinY - rz * cosY;  // + = frente
      const rightComp = rx * cosY + rz * sinY;    // + = derecha
      out.push({ dx: rightComp, dz: forwardComp });
    }
    return out;
  }

  reset() {
    this.caught = false;
    this.dazzle = 0;
    this._nearestUnit = null;
    for (const u of this.units) { u.spawned = false; u.anim.resetPose(); u.anim.play('run', 0.05); }
  }
}
