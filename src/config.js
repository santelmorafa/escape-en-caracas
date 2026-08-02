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

  // ---- Cámara tercera persona ORBITAL (mouse look) ------------------------
  camera: {
    fov: 64,
    near: 0.1,
    far: 1200,
    distance: 6.8,          // distancia orbital detrás del jugador
    pivotHeight: 2.0,       // altura del punto al que mira (cabeza)
    minPitch: -0.25,        // rad (mirar un poco hacia abajo)
    maxPitch: 0.95,         // rad (mirar hacia arriba)
    sensitivity: 0.0024,    // sensibilidad del mouse
    followLerp: 0.2,        // suavizado de posición de la cámara
    startYaw: 0             // yaw 0 => mirando hacia -Z
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

  // ---- Movimiento libre (tercera persona, relativo a la cámara) -----------
  // El personaje YA NO corre solo: se mueve con WASD relativo a hacia dónde
  // mira la cámara (mouse). W adelante, S atrás, A/D lateral, SHIFT sprint.
  freeMove: {
    walkSpeed: 6.8,         // m/s adelante / lateral
    backSpeed: 4.2,         // m/s hacia atrás (S)
    sprintMultiplier: 1.75, // sprint ~11.9 m/s
    accel: 16,              // qué tan rápido alcanza la velocidad objetivo
    turnLerp: 0.22          // suavizado del giro del modelo hacia el movimiento
  },

  // ---- Sprint con cooldown (visible en HUD) --------------------------------
  sprint: {
    multiplier: 1.55,       // (compat; el sprint de movimiento usa freeMove)
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

  // ---- Ciudad abierta (rejilla de manzanas) -------------------------------
  // El mundo ya no es un corredor: es una CUADRÍCULA de calles en X y Z con
  // manzanas de edificios. Puedes girar en calles laterales, tomar rutas
  // distintas y SUBIRTE a los edificios (torres escalonadas tipo "pastel de
  // bodas": cada terraza es un borde al que saltas/te agarras).
  city: {
    tileSize: 56,          // tamaño de cada manzana (m)
    streetWidth: 16,       // ancho de calle entre edificios
    sidewalk: 2.4,         // acera alrededor del edificio
    gridRadius: 3,         // (2R+1)^2 manzanas vivas alrededor del jugador
    tierHeight: [2.4, 2.8],// altura de cada terraza (saltable)
    tierSetback: 2.6,      // cuánto se estrecha cada terraza por lado (borde)
    seed: 20260801
  },

  // ---- Mundo / generación procedural (compat / valores compartidos) -------
  world: {
    chunkLength: 40,        // m por chunk
    chunksAhead: 8,         // cuántos chunks vivos por delante
    chunksBehind: 4,        // más margen atrás (ahora se puede retroceder)
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
  // Persecución en 3D REAL: cada policía tiene posición propia y persigue la
  // posición del jugador; te atrapa al entrar en captureRadius.
  police: {
    count: 3,               // policías iniciales (entre 2 y maxCount)
    maxCount: 4,
    spawnGap: 15,           // metros por detrás al aparecer / reaparecer
    captureRadius: 1.8,     // a esta distancia (m) te ATRAPAN
    proxRange: 34,          // rango del indicador/radar de proximidad
    baseSpeed: 5.9,         // m/s (menor que caminar; sprint siempre escapa)
    formationSpread: 3.0,   // separación lateral inicial entre policías
    formationDepth: 2.4,    // escalonado en profundidad al aparecer
    uniform: 0x16244d,      // azul oscuro (uniforme)
    cap: 0x0d1730,          // gorra
    skin: 0x9a7658          // tono de piel
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
    rampDistance: 2000,     // a esta distancia se alcanza la dificultad "alta"
    policeSpeedGain: 3.4,   // m/s extra de la policía a dificultad máxima (~9.3)
    extraCopEvery: 700,     // cada X m se suma un policía (hasta maxCount)
    startGapTighten: 3.0    // m menos de ventaja inicial a dificultad máxima
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
