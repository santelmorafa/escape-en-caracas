import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { AnimationSystem } from '../systems/AnimationSystem.js';
import { Materials } from '../materials/Materials.js';

// =============================================================================
// Police — IA de persecución + efectos nocturnos.
//
// 2 a 4 policías (mismo modelo humano riggeado que el jugador, clonado, con
// uniforme azul oscuro + gorra) corren DETRÁS del jugador. Se modela la BRECHA
// (gap): gap += (vel_jugador - vel_policía)·dt. Lento/tropiezo -> se acercan;
// esquivar/sprint -> se alejan. Al llegar a minGap te ATRAPAN (muerte).
//
// De NOCHE (setNight): cada policía enciende una LINTERNA (SpotLight real, sin
// sombra) que BARRE la escena hacia adelante; cuando el cono te apunta de frente
// deslumbra (this.dazzle -> HUD). Una PATRULLA al fondo lleva SIRENA con luces
// roja/azul alternando (2 PointLights) que se reflejan en el entorno.
//
// Rendimiento: nº de luces dinámicas limitado (maxFlashlights + 2 de sirena),
// ninguna proyecta sombras.
// =============================================================================

const POL = CONFIG.police;
const N = CONFIG.night;

const X_OFFSETS = [0, -1, 1, -2];
const DEPTH_OFFSETS = [0, 0.7, 1.3, 2.0];

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

    this.gap = POL.startGap;
    this.proximity = 0;
    this.activeCount = Math.min(2, POL.maxCount);

    this.nightFactor = 0;
    this.dazzle = 0;         // 0..1 -> deslumbramiento al jugador (HUD)
    this._t = 0;            // acumulador de tiempo para barrido/sirena
    this.patrol = null;
  }

  async load(assetLoader) {
    for (let i = 0; i < POL.maxCount; i++) {
      const anim = new AnimationSystem(assetLoader, {
        uniform: POL.uniform, cap: true, capColor: POL.cap
      });
      await anim.load();
      const root = anim.object3d;
      root.rotation.y = Math.PI;
      root.visible = false;
      this.scene.add(root);
      anim.play('run', 0.1);

      // linterna (solo para los primeros maxFlashlights)
      let flashlight = null, flashTarget = null;
      if (i < N.maxFlashlights) {
        flashlight = new THREE.SpotLight(
          N.flashlightColor, 0, N.flashlightDistance, N.flashlightAngle, N.flashlightPenumbra, 2
        );
        flashlight.castShadow = false;
        flashTarget = new THREE.Object3D();
        this.scene.add(flashlight);
        this.scene.add(flashTarget);
        flashlight.target = flashTarget;
      }

      this.units.push({
        anim, root, flashlight, flashTarget,
        xOff: X_OFFSETS[i] * POL.formationSpread,
        depthOff: DEPTH_OFFSETS[i] * POL.formationDepth
      });
    }

    this._buildPatrol();
    return this;
  }

  spawn() {}

  // Patrulla al fondo del pelotón: carrocería + barra de luces + sirena.
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
    part(dark, W * 0.6, 0.35, L, 0, 0.62, 0);           // franja lateral oscura
    part(white, W * 0.92, 0.6, L * 0.5, 0, 1.15, -0.1);
    part(Materials.glassDark(), W * 0.94, 0.5, L * 0.5 - 0.05, 0, 1.16, -0.1);
    // ruedas
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, Materials.rubber());
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * (W / 2 - 0.05), 0.35, sz * (L / 2 - 0.9));
      g.add(w);
    }
    // faros
    for (const sx of [-1, 1]) part(Materials.headlight(), 0.35, 0.22, 0.1, sx * W * 0.32, 0.75, -L / 2 + 0.02);

    // barra de luces (dos mitades emissive que parpadean)
    this._sirenRedMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1a1a, emissiveIntensity: 0 });
    this._sirenBlueMat = new THREE.MeshStandardMaterial({ color: 0x00073a, emissive: 0x1a4dff, emissiveIntensity: 0 });
    part(this._sirenRedMat, 0.42, 0.18, 0.5, -0.3, 1.52, -0.1);
    part(this._sirenBlueMat, 0.42, 0.18, 0.5, 0.3, 1.52, -0.1);
    part(dark, 0.95, 0.06, 0.55, 0, 1.44, -0.1);        // base de la barra

    // sirena: 2 luces reales (rojo/azul) que se reflejan en el entorno
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

  _difficulty(distance) {
    return THREE.MathUtils.clamp(distance / CONFIG.difficulty.rampDistance, 0, 1);
  }

  update(dt, player) {
    if (!this.enabled || this.units.length === 0) return;
    this._t += dt;

    if (player.dead) {
      for (const u of this.units) u.anim.update(dt);
      this._updateNightFX(player, true);
      return;
    }

    this._lastDistance = player.distance;
    const D = this._difficulty(player.distance);
    const policeSpeed = POL.baseSpeed + CONFIG.difficulty.policeSpeedGain * D;

    this.gap += (player.speed - policeSpeed) * dt;
    this.gap = THREE.MathUtils.clamp(this.gap, 0, POL.maxGap);

    this.activeCount = THREE.MathUtils.clamp(
      2 + Math.floor(player.distance / CONFIG.difficulty.extraCopEvery),
      2, POL.maxCount
    );

    this.proximity = 1 - THREE.MathUtils.clamp(
      (this.gap - POL.minGap) / (POL.startGap - POL.minGap), 0, 1
    );

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      const active = i < this.activeCount;
      u.root.visible = active;
      if (!active) continue;

      const behind = this.gap + u.depthOff;
      const zx = player.pos.z + behind;
      let x = player.pos.x + u.xOff;
      x = THREE.MathUtils.clamp(x, -CONFIG.world.roadWidth / 2, CONFIG.world.roadWidth / 2);
      const gy = this.world.groundHeightAt(x, zx);
      const y = gy === null ? 0 : gy;
      u.root.position.set(x, y, zx);

      if (i === 0 && this.gap <= POL.minGap && !this.caught) {
        this.caught = true;
        u.anim.play('capture', 0.12);
        if (this.onCaught) this.onCaught();
      } else if (!this.caught) {
        u.anim.play('run');
      }
      u.anim.update(dt);
    }

    this._updateNightFX(player, false);
  }

  // Linternas (barrido + deslumbramiento) y sirena de la patrulla.
  _updateNightFX(player, frozen) {
    const nf = this.nightFactor;
    let dazzle = 0;

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.flashlight) continue;
      const on = (i < this.activeCount) && nf > 0.02;
      u.flashlight.intensity = on ? N.flashlightIntensity * nf : 0;
      if (!on) continue;

      // origen: pecho del policía; el barrido oscila lateralmente el objetivo
      const cop = u.root.position;
      u.flashlight.position.set(cop.x, 1.5, cop.z);
      const sweep = Math.sin(this._t * N.flashlightSweepSpeed + i * 1.7) * N.flashlightSweepAmp;
      const aimX = cop.x + sweep;
      u.flashTarget.position.set(aimX, 0.4, cop.z - 14);
      u.flashTarget.updateMatrixWorld();

      // deslumbrar: cuánto se acerca el barrido a la X del jugador (te apunta)
      const miss = Math.abs(aimX - player.pos.x);
      const aligned = THREE.MathUtils.clamp(1 - miss / N.dazzleWidth, 0, 1);
      const proxBoost = THREE.MathUtils.clamp(1 - (this.gap - POL.minGap) / 34, 0.25, 1);
      dazzle = Math.max(dazzle, aligned * proxBoost);
    }
    this.dazzle = frozen ? this.dazzle : dazzle * nf;

    // ---- patrulla + sirena ----
    if (this.patrol) {
      this.patrol.visible = true;
      const pz = player.pos.z + this.gap + POL.formationDepth * 3 + 6;
      const px = THREE.MathUtils.clamp(player.pos.x * 0.3, -4, 4);
      this.patrol.position.set(px, 0, pz);

      // parpadeo rojo/azul alternante
      const phase = Math.floor(this._t * N.sirenHz) % 2 === 0;
      const boost = 0.35 + 0.65 * nf;                 // más fuerte de noche
      this._sirenRedMat.emissiveIntensity = phase ? 2.4 : 0.15;
      this._sirenBlueMat.emissiveIntensity = phase ? 0.15 : 2.4;
      this._sirenRed.intensity = (phase ? N.sirenIntensity : 0) * boost;
      this._sirenBlue.intensity = (phase ? 0 : N.sirenIntensity) * boost;
    }
  }

  onPlayerStumble() {
    this.gap = Math.max(POL.minGap + 0.5, this.gap - POL.stumbleGapLoss);
  }

  radarUnits() {
    const out = [];
    for (let i = 0; i < this.activeCount && i < this.units.length; i++) {
      out.push({ dz: this.gap + this.units[i].depthOff, dx: this.units[i].xOff });
    }
    return out;
  }

  reset() {
    this.caught = false;
    this.dazzle = 0;
    const D = this._difficulty(this._lastDistance || 0);
    this.gap = Math.max(POL.minGap + 4, POL.startGap - CONFIG.difficulty.startGapTighten * D);
    for (const u of this.units) {
      u.anim.resetPose();
      u.anim.play('run', 0.05);
    }
  }
}
