// =============================================================================
// Configuración central de "Escape en Caracas".
// Todo lo tuneable vive aquí para que las iteraciones futuras cambien números,
// no arquitectura. Las FEATURES marcadas como `false` tienen su módulo stub
// listo en src/future/ para activarse sin tocar el resto del juego.
// =============================================================================

export const CONFIG = {
  // ---- Render / rendimiento ------------------------------------------------
  render: {
    targetFPS: 60,
    pixelRatioCap: 1.75,        // limita devicePixelRatio en pantallas retina
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    toneMappingExposure: 1.05,
    bloom: true,
    bloomStrength: 0.55,
    bloomRadius: 0.5,
    bloomThreshold: 0.85,
    ssao: false,                // caro; actívalo si la laptop lo aguanta
    fog: { color: 0xbfc9d1, near: 60, far: 340 }
  },

  // ---- Cámara tercera persona ---------------------------------------------
  camera: {
    fov: 62,
    near: 0.1,
    far: 1200,
    offset: { x: 0, y: 4.2, z: 7.5 }, // detrás y elevada
    lookAtHeight: 1.6,
    positionLerp: 0.08,               // suavizado de posición
    lookLerp: 0.12,                   // suavizado del objetivo
    lateralFollow: 0.9                // cuánto sigue el desplazamiento lateral
  },

  // ---- Jugador -------------------------------------------------------------
  player: {
    baseSpeed: 14,          // m/s de crucero
    minSpeed: 9,
    maxSpeed: 22,
    accel: 6,               // W acelera hacia maxSpeed
    decel: 8,
    lateralSpeed: 9,        // m/s al pulsar A/D
    corridorHalfWidth: 8.5, // límite lateral (el corredor mide ~17m)
    gravity: -32,
    jumpVelocity: 13.5,     // apex ~2.8 m: permite subirse a techos bajos
    hardLandingVy: -18,     // caídas más rápidas que esto disparan el roll
    slideDuration: 0.85,    // s
    slideSpeedBoost: 1.15,
    standHeight: 2.0,       // altura de colisión de pie (se recalcula del modelo)
    slideHeight: 1.0,       // agachado
    radius: 0.5,
    rollDuration: 0.7,
    stepHeight: 0.7,        // escalón máximo que sube sin saltar (bordillos, gradas)
    // tropiezo: chocar de lado con un obstáculo ya NO mata; te frena y la
    // policía se te acerca (la muerte por obstáculo es caer a un hueco/vacío).
    stumbleSpeed: 7,        // velocidad a la que caes al tropezar
    stumbleDuration: 0.7,   // s con la velocidad limitada tras tropezar
    stumbleCooldown: 0.8    // s de inmunidad para no encadenar tropiezos
  },

  // ---- Sprint con cooldown (visible en HUD) --------------------------------
  sprint: {
    multiplier: 1.55,
    duration: 3.2,          // s de sprint
    cooldown: 4.5           // s de recarga
  },

  // ---- Audio (sintetizado con Web Audio, sin archivos) ---------------------
  audio: {
    master: 0.55,
    ambience: 0.22,         // rumor urbano
    music: 0.5,             // música de tensión (escala con cercanía policial)
    siren: 0.5,             // sirena lejana (sube cuando la policía se acerca)
    strideLength: 2.1       // m entre pasos (sonido de pisadas)
  },

  // ---- Partículas (polvo) --------------------------------------------------
  particles: {
    max: 220,
    color: 0xcdb892
  },

  // ---- Motion blur (leve, sólo en sprint) ----------------------------------
  motionBlur: {
    sprintDamp: 0.5         // "estela" máxima del afterimage en sprint (0 = off)
  },

  // ---- Mundo / generación procedural --------------------------------------
  world: {
    chunkLength: 40,        // m por chunk
    chunksAhead: 8,         // cuántos chunks vivos por delante
    chunksBehind: 2,        // se reciclan al quedar detrás
    roadWidth: 17,
    sidewalkWidth: 4,
    warmupChunks: 3,        // primeros chunks sin obstáculos ni huecos
    obstacleDensity: 0.48,  // prob. de obstáculo por slot (rebalance: algo menos)
    pitChance: 0.12,        // prob. de hueco en la vía por chunk
    rooftopChance: 0.52,    // prob. de azotea transitable (subir a techos es clave)
    seed: 20260801
  },

  // ---- Checkpoints ---------------------------------------------------------
  checkpoints: {
    interval: 300           // m entre checkpoints
  },

  // ---- El Ávila / entorno --------------------------------------------------
  environment: {
    avilaSide: 'left',      // a qué costado del horizonte se ve el cerro
    avilaDistance: 420,
    skyTopColor: 0x88b5e8,
    skyBottomColor: 0xdfe8ef,
    sunColor: 0xfff2d8,
    sunIntensity: 2.6,
    hemiSky: 0xbcd6ff,
    hemiGround: 0x6b5d4f,
    hemiIntensity: 0.75
  },

  // ---- Assets del personaje (pipeline estilo Mixamo) -----------------------
  // El AnimationSystem intenta cargar primero los archivos LOCALES; si no están,
  // usa los FALLBACK por CDN (modelo humano riggeado real, nunca primitivas).
  // Para el set completo Mixamo: coloca los .glb en public/models/ (ver README).
  character: {
    local: {
      model: 'models/character.glb',
      clips: {
        run:     'models/anim_run.glb',
        jump:    'models/anim_jump.glb',
        roll:    'models/anim_roll.glb',
        slide:   'models/anim_slide.glb',
        death:   'models/anim_death.glb',
        idle:    'models/anim_idle.glb',
        capture: 'models/anim_capture.glb', // policía agarrando (Mixamo: "Grab"/"Punching")
        ledge:   'models/anim_ledge.glb',   // colgarse del borde (Mixamo: "Hanging Idle")
        climb:   'models/anim_climb.glb'     // trepar (Mixamo: "Climbing Up"/"Braced Hang To Crouch")
      }
    },
    // Modelo humano riggeado con animaciones incluidas (three.js example asset,
    // licencia permisiva). Sirve como personaje real de arranque.
    fallbackModel: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    // Nombres de clips esperados. El sistema mapea alias comunes de Mixamo.
    clipAliases: {
      idle:  ['idle', 'Idle', 'mixamo.com', 'Armature|Idle'],
      run:   ['run', 'Run', 'Running', 'Armature|Run'],
      jump:  ['jump', 'Jump', 'Jumping'],
      roll:  ['roll', 'Roll', 'Rolling', 'FallingToRoll'],
      slide: ['slide', 'Slide', 'RunningSlide', 'Crouch', 'Crouching'],
      death: ['death', 'Death', 'Dying', 'FallingDeath'],
      walk:  ['walk', 'Walk', 'Walking'],
      capture: ['capture', 'Grab', 'Grabbing', 'Punch', 'Punching', 'Tackle'],
      ledge: ['ledge', 'hang', 'Hanging', 'HangingIdle', 'BracedHang'],
      climb: ['climb', 'Climbing', 'ClimbingUp', 'ClimbUp', 'HangToCrouch']
    },
    scale: 1.0,
    targetHeight: 2.15,     // altura objetivo del modelo (m) — "jugador más grande"
    crossfade: 0.22         // s de transición entre animaciones
  },

  // ---- Policía (persecución) ----------------------------------------------
  police: {
    count: 3,               // policías iniciales (entre 2 y maxCount)
    maxCount: 4,
    startGap: 18,           // metros por detrás al empezar / reaparecer
    minGap: 1.7,            // a esta distancia te ATRAPAN
    maxGap: 46,             // no se dibujan más lejos (siguen acechando)
    baseSpeed: 12.6,        // m/s base (rebalance: arranque más justo)
    stumbleGapLoss: 5.0,    // metros que la policía recorta cuando tropiezas
    formationSpread: 2.8,   // separación lateral entre policías
    formationDepth: 2.6,    // escalonado en profundidad entre policías
    uniform: 0x16244d,      // azul oscuro (uniforme)
    cap: 0x0d1730,          // gorra
    skin: 0x9a7658          // tono de piel para manos/cara del override
  },

  // ---- Ciclo día/noche -----------------------------------------------------
  // El mundo transiciona gradualmente a noche cada `cycleDistance` metros.
  // nightFactor: 0 = día pleno, 1 = medianoche. Se deriva de la distancia.
  // Rendimiento: se limita el nº de luces dinámicas simultáneas; ventanas,
  // faros y letreros usan EMISSIVE (gratis), no luces.
  night: {
    cycleDistance: 850,        // m de un ciclo completo día -> noche -> día
    // faroles (pool de PointLights que sigue al jugador)
    maxLampLights: 5,          // luces de farol simultáneas (charcos de luz)
    lampColor: 0xffa24d,       // cálida anaranjada
    lampIntensity: 34,         // candelas (decay 2)
    lampDistance: 22,
    lampHeight: 5.4,
    lampSpacing: 20,           // coincide con la separación de faroles
    lampInset: 6.5,            // x del charco de luz (sobre el asfalto)
    // linternas de policías (SpotLights, sin sombra)
    maxFlashlights: 3,
    flashlightColor: 0xfff2d0,
    flashlightIntensity: 55,
    flashlightAngle: 0.40,     // rad (semiapertura del cono)
    flashlightPenumbra: 0.45,
    flashlightDistance: 36,
    flashlightSweepSpeed: 1.3, // rad/s del barrido
    flashlightSweepAmp: 5.0,   // amplitud lateral del barrido (m)
    dazzleWidth: 2.6,          // margen (m) para deslumbrar al apuntarte
    // sirena de patrulla (rojo/azul alternante)
    sirenIntensity: 10,
    sirenHz: 3.2,              // parpadeos por segundo
    sirenDistance: 16,
    // emissive de ventanas / faros al 100% de noche
    windowEmissive: 1.3,
    headlightEmissive: 2.2
  },

  // ---- Dificultad progresiva ----------------------------------------------
  difficulty: {
    rampDistance: 2000,     // rebalance: rampa más larga y gradual
    policeSpeedGain: 3.8,   // m/s extra de la policía a dificultad máxima
    extraCopEvery: 700,     // cada X m se suma un policía (hasta maxCount)
    startGapTighten: 4.0    // m menos de ventaja inicial a dificultad máxima
  },

  // ---- FEATURES futuras (hooks listos, implementación en src/future/) ------
  features: {
    police: true,           // IA de persecución (ACTIVADA)
    dayNightCycle: true,    // ciclo día/noche + linternas (ACTIVADO)
    mobileControls: false,  // fuerza botones táctiles aunque no sea táctil (test)
    ledgeGrab: true         // agarre automático de bordes (ACTIVADO)
  },

  // ---- Agarre de bordes (ledge grab) --------------------------------------
  // Rango pensado para PREMIAR saltos casi logrados sin regalar los malos:
  // sólo agarra si los pies quedan como mucho `reach` por debajo del borde Y
  // estás pegado al canto (a `outReach` por fuera o `inReach` por dentro).
  ledgeGrab: {
    reach: 1.25,            // m máx. que los pies pueden quedar por DEBAJO del borde
    minRise: 0.05,          // m mín. (el borde debe estar por encima de los pies)
    outReach: 0.75,         // m de alcance horizontal desde fuera del canto
    inReach: 0.6,           // m si ya entraste un poco: agarra si sigues junto al canto
    minLedgeHeight: 1.5,    // sólo cantos altos (azoteas/contenedores), no bordillos
    hangDrop: 1.0,          // m que cuelga el cuerpo por debajo del borde
    hangDuration: 0.32,     // s colgado antes de trepar
    climbDuration: 0.42,    // s de trepada
    cooldown: 0.4           // s tras trepar antes de poder reagarrarse
  },

  // ---- Perfil de rendimiento para móvil (se aplica si se detecta táctil) ----
  mobile: {
    pixelRatioCap: 1.3,     // resolución tope (los teléfonos tienen DPR 2-3)
    minResScale: 0.6,       // límite inferior de la resolución dinámica
    shadowMapSize: 1024,    // sombras más baratas
    chunksAhead: 6,         // menos chunks vivos por delante
    maxLampLights: 3,       // menos luces dinámicas de noche
    maxFlashlights: 2
  },
  mobileActive: false,      // lo pone Game al detectar móvil

  debug: false
};

// Detección de dispositivo táctil "de verdad" (teléfono/tablet), no un portátil
// con pantalla táctil + ratón (ese se queda con teclado).
export function detectMobile() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  return touch && coarse;
}

// Aplica el perfil móvil MUTANDO CONFIG (antes de crear renderer/mundo/luces).
export function applyMobileProfile() {
  const m = CONFIG.mobile;
  CONFIG.render.pixelRatioCap = m.pixelRatioCap;
  CONFIG.render.shadowMapSize = m.shadowMapSize;
  CONFIG.world.chunksAhead = m.chunksAhead;
  CONFIG.night.maxLampLights = m.maxLampLights;
  CONFIG.night.maxFlashlights = m.maxFlashlights;
  CONFIG.mobileActive = true;
}
