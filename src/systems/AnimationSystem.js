import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';

// =============================================================================
// AnimationSystem — pipeline estilo Mixamo, compartido por jugador Y policías.
//
// El modelo humano riggeado + sus clips se cargan UNA sola vez (plantilla en
// caché de módulo) y cada personaje se obtiene CLONANDO el rig con
// SkeletonUtils. Así el jugador y los 2-4 policías son el mismo modelo humano
// real (nunca primitivas), cada uno con su propio AnimationMixer.
//
// Opciones por instancia: `uniform` (color de override para el uniforme),
// `cap` (añade una gorra al hueso de la cabeza) — usadas por los policías.
//
// Clips lógicos: run | jump | roll | slide | death | idle | capture.
// Los que no tengan mocap real usan un fallback PROCEDURAL sobre el esqueleto
// real (agacharse, rodar, morir, agarrar). Al añadir los GLB de Mixamo pasan a
// mocap real automáticamente.
// =============================================================================

// ---- caché de plantilla (se comparte entre todas las instancias) -----------
let _templatePromise = null;

function loadTemplate(assetLoader) {
  if (_templatePromise) return _templatePromise;
  _templatePromise = (async () => {
    const cfg = CONFIG.character;
    const { gltf, usedFallback } = await assetLoader.loadGLTFWithFallback(
      cfg.local.model, cfg.fallbackModel
    );
    const clipPool = [...(gltf.animations || [])];
    // GLB de animación separados (flujo Mixamo, opcionales)
    for (const [name, url] of Object.entries(cfg.local.clips)) {
      try {
        const animGltf = await assetLoader.loadGLTF(url);
        for (const clip of animGltf.animations) {
          clip.userData = { logical: name };
          clipPool.push(clip);
        }
      } catch (_) { /* se resuelve por alias o fallback */ }
    }
    return { scene: gltf.scene, clipPool, usedFallback };
  })();
  return _templatePromise;
}

export class AnimationSystem {
  constructor(assetLoader, options = {}) {
    this.loader = assetLoader;
    this.options = options;          // { uniform, cap, capColor, skin }
    this.mixer = null;
    this.model = null;
    this.root = new THREE.Group();
    this.actions = {};
    this.current = null;
    this.currentName = null;
    this._proc = {};
    this.usedFallbackModel = false;
    this.missingClips = [];
    this.baseScale = CONFIG.character.scale;
    this.modelHeight = CONFIG.player.standHeight;
  }

  async load() {
    const cfg = CONFIG.character;
    const tpl = await loadTemplate(this.loader);
    this.usedFallbackModel = tpl.usedFallback;

    // clonar el rig (esqueleto independiente) para esta instancia
    this.model = SkeletonUtils.clone(tpl.scene);

    // auto-escala a la altura objetivo y planta los pies en y=0.
    // IMPORTANTE: actualizar matrices de mundo antes de medir la bbox (el clon
    // recién creado no las tiene calculadas -> mediría en espacio local).
    this.model.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(this.model);
    const rawH = Math.max(0.001, bbox.max.y - bbox.min.y);
    this.baseScale = THREE.MathUtils.clamp((cfg.targetHeight || 1.8) / rawH, 0.05, 20);
    this.modelHeight = cfg.targetHeight || rawH;
    this.model.scale.setScalar(this.baseScale);
    this.model.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(this.model);
    this.model.position.y = -scaledBox.min.y;   // plantar pies en y=0

    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (this.options.uniform !== undefined) {
          o.material = this._uniformMaterial(o);
        }
      }
    });

    if (this.options.cap) this._addCap();

    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);

    this._buildActions(tpl.clipPool);
    this._registerProceduralFallbacks();
    this.play('idle', 0);
    return this;
  }

  // Material de uniforme: azul oscuro para el cuerpo. (Es un override de color
  // sobre el mismo modelo humano real; no cambia la malla.)
  _uniformMaterial() {
    return new THREE.MeshStandardMaterial({
      color: this.options.uniform,
      roughness: 0.72,
      metalness: 0.06
    });
  }

  // Gorra de policía anclada al hueso de la cabeza (accesorio, sigue la anim).
  _addCap() {
    let head = null;
    this.model.traverse((o) => {
      if (o.isBone && !head && /head/i.test(o.name)) head = o;
    });
    const capColor = this.options.capColor ?? 0x0d1730;
    const cap = new THREE.Group();
    const domeGeo = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.6, metalness: 0.1 });
    const dome = new THREE.Mesh(domeGeo, mat);
    dome.castShadow = true;
    cap.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12, 1, false, 0, Math.PI), mat);
    brim.position.set(0, 0.0, 0.11);
    brim.rotation.x = Math.PI;
    cap.add(brim);

    if (head) {
      // normalizar por la escala de mundo del hueso (rigs FBX a veces traen 100x)
      this.model.updateWorldMatrix(true, true);
      const ws = new THREE.Vector3();
      head.getWorldScale(ws);
      const s = this.baseScale / (ws.x || this.baseScale);
      cap.scale.setScalar(s);
      cap.position.set(0, 0.16 / (ws.y || 1), 0.02 / (ws.z || 1));
      head.add(cap);
    } else {
      // sin hueso de cabeza: colocarla arriba del modelo
      cap.position.set(0, this.modelHeight * 0.94, 0.05);
      this.root.add(cap);
    }
    this._cap = cap;
  }

  _findClip(pool, aliases) {
    for (const a of aliases) {
      const exact = pool.find((c) => c.name === a || c.userData?.logical === a);
      if (exact) return exact;
    }
    const low = aliases.map((a) => a.toLowerCase());
    return pool.find((c) => low.some((a) => c.name.toLowerCase().includes(a))) || null;
  }

  _buildActions(pool) {
    const aliases = CONFIG.character.clipAliases;
    const once = new Set(['jump', 'roll', 'death', 'slide', 'capture', 'climb']);
    for (const logical of ['idle', 'run', 'jump', 'roll', 'slide', 'death', 'walk', 'capture', 'ledge', 'climb']) {
      const clip = this._findClip(pool, aliases[logical] || [logical]);
      if (clip) {
        const action = this.mixer.clipAction(clip);
        if (once.has(logical)) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        this.actions[logical] = action;
      } else {
        this.missingClips.push(logical);
      }
    }
    if (!this.actions.run && this.actions.walk) this.actions.run = this.actions.walk;
    if (!this.actions.idle && this.actions.run) this.actions.idle = this.actions.run;
  }

  _registerProceduralFallbacks() {
    this._proc = {
      slide:   { enter: () => { this._targetCrouch = 1; }, exit: () => { this._targetCrouch = 0; } },
      roll:    { enter: () => { this._rollT = 0; this._rolling = true; }, exit: () => { this._rolling = false; } },
      jump:    { enter: () => { this._jumpTilt = 1; }, exit: () => { this._jumpTilt = 0; } },
      death:   { enter: () => { this._deathT = 0; this._dying = true; }, exit: () => { this._dying = false; } },
      capture: { enter: () => { this._capturing = true; }, exit: () => { this._capturing = false; } },
      // agarrarse / trepar: los brazos suben a "agarrar" el borde o la escalera
      ledge:   { enter: () => { this._reachTarget = 1; }, exit: () => { this._reachTarget = 0; } },
      climb:   { enter: () => { this._reachTarget = 1; }, exit: () => { this._reachTarget = 0; } }
    };
    this._targetCrouch = 0; this._crouch = 0;
    this._rolling = false; this._rollT = 0;
    this._dying = false; this._deathT = 0;
    this._jumpTilt = 0; this._capturing = false;
    this._reach = 0; this._reachTarget = 0;
    this._cacheArms();
  }

  // Localiza los huesos de los brazos y guarda su pose de reposo + la pose de
  // "agarre" (manos arriba/adelante). Se aplica encima de la animación base.
  _cacheArms() {
    let lU, rU, lF, rF;
    this.model.traverse((o) => {
      if (!o.isBone) return;
      const n = o.name.toLowerCase();
      if (n.includes('forearm')) {
        if (n.includes('left') && !lF) lF = o; else if (n.includes('right') && !rF) rF = o;
      } else if (n.includes('arm') && !n.includes('shoulder') && !n.includes('clav')) {
        if (n.includes('left') && !lU) lU = o; else if (n.includes('right') && !rU) rU = o;
      }
    });
    const mk = (b) => (b ? { bone: b, rest: b.quaternion.clone() } : null);
    this._arms = { lU: mk(lU), rU: mk(rU), lF: mk(lF), rF: mk(rF) };
    const E = new THREE.Euler();
    this._reachQ = {
      lU: new THREE.Quaternion().setFromEuler(E.set(0.5, 0, -2.0)),
      rU: new THREE.Quaternion().setFromEuler(E.set(0.5, 0, 2.0)),
      lF: new THREE.Quaternion().setFromEuler(E.set(-0.95, 0, 0)),
      rF: new THREE.Quaternion().setFromEuler(E.set(-0.95, 0, 0))
    };
    this._idQ = new THREE.Quaternion();
    this._tmpQ = new THREE.Quaternion();
  }

  hasRealClip(name) {
    return !!this.actions[name] && !this.missingClips.includes(name);
  }

  play(name, fade = CONFIG.character.crossfade) {
    if (this.currentName === name) return;
    if (this.currentName && this._proc[this.currentName]) this._proc[this.currentName].exit();

    const action = this.actions[name] || this.actions.run || this.actions.idle;
    if (action && this.hasRealClip(name)) {
      if (this.current && this.current !== action) this.current.fadeOut(fade);
      action.reset().setEffectiveWeight(1).fadeIn(fade).play();
      this.current = action;
    } else if (this._proc[name]) {
      const base = this.actions.run || this.actions.idle;
      if (base && this.current !== base) {
        if (this.current) this.current.fadeOut(fade);
        base.reset().fadeIn(fade).play();
        this.current = base;
      }
      this._proc[name].enter();
    }
    this.currentName = name;
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    const m = this.model;
    if (!m) return;
    const bs = this.baseScale;

    // agacharse (slide)
    this._crouch += (this._targetCrouch - this._crouch) * Math.min(1, dt * 12);
    m.scale.y = bs * (1 - 0.45 * this._crouch);

    // rodar
    if (this._rolling) {
      this._rollT += dt / CONFIG.player.rollDuration;
      m.rotation.x = -Math.PI * 2 * Math.min(1, this._rollT);
      if (this._rollT >= 1) { m.rotation.x = 0; this._rolling = false; }
    } else if (!this._dying && !this._capturing) {
      m.rotation.x += (0 - m.rotation.x) * Math.min(1, dt * 10);
    }

    // muerte
    if (this._dying) {
      this._deathT += dt / 0.8;
      m.rotation.x = -Math.PI * 0.5 * Math.min(1, this._deathT);
    }

    // captura (policía): lanzarse hacia adelante (inclinación + estirar)
    if (this._capturing) {
      const target = 0.5;
      m.rotation.x += (target - m.rotation.x) * Math.min(1, dt * 12);
    }

    // brazos agarrándose (borde/escalera): sobrescribe la pose de los brazos
    this._reach += (this._reachTarget - this._reach) * Math.min(1, dt * 10);
    if (this._arms && this._reach > 0.01) {
      for (const k of ['lU', 'rU', 'lF', 'rF']) {
        const a = this._arms[k];
        if (!a) continue;
        this._tmpQ.copy(this._idQ).slerp(this._reachQ[k], this._reach); // offset parcial
        a.bone.quaternion.copy(a.rest).multiply(this._tmpQ);
      }
    }
  }

  resetPose() {
    if (!this.model) return;
    this.model.rotation.set(0, 0, 0);
    this.model.scale.setScalar(this.baseScale);
    this._targetCrouch = 0; this._crouch = 0;
    this._rolling = false; this._dying = false; this._capturing = false;
    this._reachTarget = 0;
    this.currentName = null;
    this.play('run', 0.05);
  }

  get object3d() { return this.root; }
}
