import * as THREE from 'three';
import { CONFIG, detectMobile, applyMobileProfile } from '../config.js';
import { Loop } from './Loop.js';
import { AssetLoader } from './AssetLoader.js';

import { Input } from '../systems/Input.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { AnimationSystem } from '../systems/AnimationSystem.js';
import { Player } from '../systems/Player.js';
import { WorldGenerator } from '../systems/WorldGenerator.js';
import { CollisionSystem } from '../systems/Collision.js';
import { CheckpointSystem } from '../systems/Checkpoints.js';
import { Environment } from '../systems/Environment.js';
import { Lighting } from '../systems/Lighting.js';
import { NightLights } from '../systems/NightLights.js';
import { PostProcessing } from '../systems/PostProcessing.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { Particles } from '../systems/Particles.js';
import { HUD } from '../hud/HUD.js';

// [Futuro] hooks
import { Police } from '../future/Police.js';
import { DayNightCycle } from '../future/DayNightCycle.js';
import { MobileControls } from '../future/MobileControls.js';
import { LedgeGrab } from '../future/LedgeGrab.js';

// =============================================================================
// Game — orquestador central. Crea y conecta todos los sistemas y corre el
// bucle. Cada sistema es independiente y se comunica por interfaces mínimas,
// de modo que activar una FEATURE futura es instanciar su módulo y llamarlo.
// =============================================================================

export class Game {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.state = 'loading';   // loading | menu | playing | paused
    this._mb = 0;             // motion blur suavizado
  }

  async init(onLoadProgress) {
    // ---- detección de móvil / perfil de rendimiento ----
    // ?mobile=1 fuerza el modo táctil (útil para probar en escritorio).
    const forceMobile = new URLSearchParams(location.search).get('mobile') === '1';
    this.isMobile = forceMobile || detectMobile();
    this.showTouch = this.isMobile || CONFIG.features.mobileControls;
    // aplicar perfil móvil ANTES de crear renderer/mundo/luces (mutan CONFIG)
    if (this.isMobile || CONFIG.features.mobileControls) applyMobileProfile();
    this._resScale = 1; this._fpsAccum = 0; this._fpsFrames = 0;

    // ---- renderer ----
    this.renderer = new THREE.WebGLRenderer({ antialias: CONFIG.render.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = CONFIG.render.toneMappingExposure;
    this.renderer.shadowMap.enabled = CONFIG.render.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.rootEl.appendChild(this.renderer.domElement);

    // ---- escena ----
    this.scene = new THREE.Scene();

    // ---- sistemas de mundo/entorno ----
    this.environment = new Environment(this.scene);
    this.lighting = new Lighting(this.scene);
    this.world = new WorldGenerator(this.scene);
    this.world.init();
    this.checkpoints = new CheckpointSystem(this.scene);

    // ---- cámara ----
    this.cameraSystem = new CameraSystem(window.innerWidth / window.innerHeight);

    // ---- personaje (modelo humano riggeado + animaciones) ----
    onLoadProgress?.(0.15, 'Cargando personaje…');
    this.assets = new AssetLoader((url, p) => {
      onLoadProgress?.(0.15 + p * 0.7, 'Cargando personaje…');
    });
    this.anim = new AnimationSystem(this.assets);
    await this.anim.load();
    // el jugador es "más grande": ajustar la colisión a la altura real del modelo
    CONFIG.player.standHeight = this.anim.modelHeight;
    CONFIG.player.slideHeight = this.anim.modelHeight * 0.5;
    this.scene.add(this.anim.object3d);
    this.player = new Player(this.anim);

    // ---- audio (sintetizado) + partículas ----
    this.audio = new AudioSystem();
    this.particles = new Particles(this.scene);

    // ---- input / colisión / hud ----
    this.input = new Input();
    this.collision = new CollisionSystem(this.world);
    this.hud = new HUD(document.getElementById('hud'));
    this.hud.onContinue = () => this._respawn();
    this.hud.onToMenu = () => this.toMenu();
    this.hud.onPlay = () => this.play();
    this.hud.onResume = () => this.resumeGame();
    this.hud.onPauseRequest = () => { if (this.state === 'playing' && !this.player.dead) this.pauseGame(); };
    this.hud.onToggleMute = () => { this.audio.init(); this.hud.setMute(this.audio.toggleMute()); };

    // ---- postprocesado ----
    onLoadProgress?.(0.92, 'Preparando render…');
    this.post = new PostProcessing(this.renderer, this.scene, this.cameraSystem.camera,
      { w: window.innerWidth, h: window.innerHeight });

    // ---- FEATURES futuras (guardadas por flags) ----
    this._initFutureFeatures();

    // ---- Policía (persecución): carga asíncrona de modelos clonados ----
    if (this.police) {
      onLoadProgress?.(0.95, 'Desplegando policías…');
      await this.police.load(this.assets);
      this.police.enabled = true;
      this.police.onCaught = () => this._die('police');
      if (this.dayNight) this.dayNight.police = this.police; // linternas/sirena
    }

    // ---- checkpoints -> HUD + sonido ----
    this.checkpoints.onReached = (dist) => { this.hud.toast(`✔ Checkpoint ${dist} m`); this.audio.checkpoint(); };

    // ---- eventos ----
    window.addEventListener('resize', () => this._onResize());

    // colocar cámara detrás del jugador
    this.cameraSystem.snapTo(this.player);

    if (this.anim.usedFallbackModel) {
      console.info('[Game] Usando personaje humano de arranque (CDN). ' +
        'Coloca tus GLB de Mixamo en public/models/ para el set completo.');
    }
    if (this.anim.missingClips.length) {
      console.info('[Game] Clips sin mocap (usan fallback procedural sobre el rig real): ' +
        this.anim.missingClips.join(', '));
    }

    onLoadProgress?.(1.0, '¡Listo!');
    this.loop = new Loop((dt) => this._update(dt));

    // arrancar en el MENÚ (el audio se inicia al pulsar JUGAR, por autoplay)
    this.state = 'menu';
    this.hud.showMenu();
  }

  _initFutureFeatures() {
    const f = CONFIG.features;
    // La policía se CREA aquí pero se CARGA (async) en init().
    this.police = f.police ? new Police(this.scene, this.world) : null;
    if (f.dayNightCycle) {
      this.nightLights = new NightLights(this.scene);
      this.dayNight = new DayNightCycle(this.lighting, this.environment, this.nightLights);
      this.dayNight.enabled = true;
    } else {
      this.dayNight = null;
    }
    this.ledgeGrab = f.ledgeGrab ? new LedgeGrab(this.player, this.world) : null;
    this.mobile = this.showTouch
      ? new MobileControls(this.input, document.getElementById('hud')) : null;
    if (this.ledgeGrab) this.ledgeGrab.enabled = true;
    if (this.mobile) this.mobile.mount();
  }

  start() { this.loop.start(); }

  _update(dt) {
    const p = this.player;

    // silenciar (M o botón)
    if (this.input.consume('mute')) this.hud.setMute(this.audio.toggleMute());

    // ---- MENÚ: sólo animar en reposo y renderizar de fondo ----
    if (this.state === 'menu') {
      this.anim.update(dt);
      this.post.setMotionBlur(0);
      this.render();
      return;
    }

    // ---- PAUSA ----
    if (this.state === 'playing' && !p.dead && this.input.consume('pause')) { this.pauseGame(); return; }
    if (this.state === 'paused') {
      if (this.input.consume('pause')) this.resumeGame();
      else { this.render(); return; }
    }

    // reaparecer con ENTER cuando estás muerto
    if (p.dead && this.input.consume('restart')) { this._respawn(); return; }

    // 1) jugador + eventos (audio/partículas)
    p.update(dt, this.input, this.world);
    if (!p.dead) this._handleEvents(p);

    // 2) mundo + entorno + luces siguen al jugador
    this.world.update(p.pos.z);
    this.environment.update(p.pos.z, p.pos.x);
    this.lighting.update(p);

    // 3) ciclo día/noche + persecución policial (linternas/sirena)
    if (this.dayNight) this.dayNight.update(dt, p);
    if (this.police) this.police.update(dt, p);

    // 4) checkpoints + avisos de hitos
    if (!p.dead) {
      this.checkpoints.update(p);
      const lm = this.world.getApproachingLandmark(p.pos.z);
      if (lm) this.hud.toast(`📍 ${lm.label}`, 2.4);
    }

    // 4.5) agarre automático de bordes (salto casi logrado)
    if (this.ledgeGrab && p.state !== 'ledge') {
      const grab = this.ledgeGrab.tryGrab();
      if (grab) p.grabLedge(grab);
    }

    // 5) colisiones (tropiezo) + muerte por caída al vacío
    if (!p.dead && p.state !== 'ledge') {
      const hit = this.collision.check(p);
      if (hit && p.stumble() && this.police) {
        this.police.onPlayerStumble();
        this.hud.toast('¡Tropezaste!', 1.0);
      }
      if (p.pos.y < -2.5) this._die('fall');
    }

    // 6) audio de tensión + motion blur + partículas
    const prox = this.police ? this.police.proximity : 0;
    const nf = this.dayNight ? this.dayNight.nightFactor : 0;
    this.audio.update(dt, { tension: prox, proximity: prox, night: nf });
    this._updateMotionBlur(dt, p);
    this.particles.update(dt);

    // 7) cámara + HUD + táctil + resolución adaptativa + render
    this.cameraSystem.update(p, dt);
    this.hud.update(p, dt, this.police, nf);
    if (this.mobile) this.mobile.update(p);
    this._adaptResolution(dt);
    this.render();
  }

  // Traduce los eventos del jugador en SFX y ráfagas de polvo.
  _handleEvents(p) {
    for (const ev of p.drainEvents()) {
      switch (ev.name) {
        case 'step':
          this.audio.step();
          if (p.sprintActive) this.particles.emit(p.pos.x, p.pos.y, p.pos.z, 3, { up: 1.0, spread: 1.0, life: 0.4, size: 7 });
          break;
        case 'jump': this.audio.jump(); break;
        case 'land':
          this.audio.land();
          this.particles.emit(p.pos.x, p.pos.y, p.pos.z, 10, { up: 2.0, spread: 1.8, life: 0.5 });
          break;
        case 'roll':
          this.audio.roll();
          this.particles.emit(p.pos.x, p.pos.y, p.pos.z, 24, { up: 2.4, spread: 2.6, back: 2, life: 0.75, size: 12 });
          break;
        case 'slide':
          this.audio.slide();
          this.particles.emit(p.pos.x, p.pos.y, p.pos.z, 16, { up: 1.2, spread: 1.8, back: -2, life: 0.6, size: 10 });
          break;
      }
    }
  }

  _updateMotionBlur(dt, p) {
    const target = (this.state === 'playing' && p.sprintActive) ? CONFIG.motionBlur.sprintDamp : 0;
    this._mb += (target - this._mb) * Math.min(1, dt * 8);
    this.post.setMotionBlur(this._mb);
  }

  // ---- transiciones de estado ----
  play() {
    this.audio.init(); this.audio.resume(); this.audio.setActive(true);
    this.hud.setMute(this.audio.muted);
    this._newGame();
    this.hud.hideMenu();
    this.state = 'playing';
  }

  pauseGame() { this.state = 'paused'; this.hud.showPause(); this.audio.setActive(false); }
  resumeGame() { this.state = 'playing'; this.hud.hidePause(); this.audio.setActive(true); }
  toMenu() {
    this.hud.hidePause(); this.hud.hideDeath();
    this._newGame();
    this.audio.setActive(false);
    this.state = 'menu';
    this.hud.showMenu();
  }

  _newGame() {
    this.checkpoints.reset();
    if (this.police) this.police._lastDistance = 0;
    this.player.respawn({ z: 0, y: 0, distance: 0 });
    this.world.update(this.player.pos.z);
    this.cameraSystem.snapTo(this.player);
    if (this.police) this.police.reset();
    this.hud.hideDeath();
    this._mb = 0;
  }

  // Resolución dinámica en móvil: baja el pixelRatio si el fps cae y lo recupera
  // cuando hay margen. En escritorio no hace nada.
  _adaptResolution(dt) {
    if (!this.isMobile) return;
    this._fpsAccum += dt; this._fpsFrames++;
    if (this._fpsAccum < 1.2) return;
    const fps = this._fpsFrames / this._fpsAccum;
    this._fpsAccum = 0; this._fpsFrames = 0;
    const cap = Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap);
    let changed = false;
    if (fps < 45 && this._resScale > CONFIG.mobile.minResScale) {
      this._resScale = Math.max(CONFIG.mobile.minResScale, this._resScale - 0.12); changed = true;
    } else if (fps > 57 && this._resScale < 1) {
      this._resScale = Math.min(1, this._resScale + 0.08); changed = true;
    }
    if (changed) {
      this.renderer.setPixelRatio(cap * this._resScale);
      if (this.post) this.post.setSize(window.innerWidth, window.innerHeight);
    }
  }

  _die(reason = 'police') {
    if (this.player.dead) return;
    this.player.kill();
    this.audio.capture();
    this.hud.showDeath(this.player.distance, reason);
  }

  _respawn() {
    this.hud.hideDeath();
    this.state = 'playing';
    const cp = this.checkpoints.respawnPoint;
    this.player.respawn(cp);
    this.world.update(this.player.pos.z);
    this.cameraSystem.snapTo(this.player);
    if (this.police) this.police.reset();
  }

  render() {
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.cameraSystem.camera);
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraSystem.onResize(w / h);
    if (this.post) this.post.setSize(w, h);
  }
}
