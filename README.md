# Escape en Caracas 🏙️🏃

Juego de **parkour infinito 3D en tercera persona** por una Caracas proceduralmente
generada. Corre, salta, deslízate y esquiva por un corredor urbano con El Ávila
siempre en el horizonte y edificios emblemáticos de la ciudad como hitos.

Construido con **Three.js + Vite**, JavaScript modular (ES modules).

---

## Cómo correrlo localmente

Requisitos: Node 18+ (probado en Node 24).

```bash
npm install
npm run dev
```

Vite abrirá el juego en `http://localhost:5173`.

> El personaje se carga como un **modelo humano riggeado real** (GLB). Si tienes
> internet, funciona out-of-the-box (usa un asset humano por CDN como arranque).
> Para tenerlo **local** y no depender del CDN:
>
> ```bash
> npm run fetch-assets
> ```
>
> Esto descarga un personaje humano riggeado a `public/models/character.glb`.

### Build de producción

```bash
npm run build
npm run preview
```

---

## Controles

| Tecla | Acción |
|-------|--------|
| **W** | Acelerar el avance |
| **A / D** | Movimiento lateral |
| **ESPACIO** | Saltar (súbete a las azoteas) |
| **S** o **Ctrl** | Agacharse / deslizarse |
| **SHIFT** | Sprint (con cooldown, visible en el HUD) — te aleja de la policía |
| **H** o **F1** | Abrir/cerrar la pantalla de ayuda (pausa el juego) |
| **ENTER** | Reaparecer tras ser atrapado |

El personaje **rueda automáticamente** al aterrizar de caídas altas, y se
**agarra automáticamente del borde** cuando un salto a una azotea se queda corto
por poco (se cuelga y trepa solo). Si el salto se queda demasiado corto, cae normal.

**P** o **Esc** pausan · **M** silencia · **H**/**F1** también abren la pausa.

### Menú, pausa y récord
El juego arranca en un **menú** con el nombre y el **récord** (mayor distancia
histórica, guardada en `localStorage`). Botón **JUGAR**, pantalla de **pausa**
(reanudar / menú principal) y, al morir, opción de continuar o volver al menú.

### Sonido y efectos (todo sintetizado / procedural, sin archivos)
- **Audio** con Web Audio: pasos, salto, aterrizaje, rodar/deslizar, ambiente
  urbano, **sirena lejana** que sube al acercarse la policía y **música de
  tensión** que se intensifica (volumen + tempo) cuanto más cerca están. Se
  inicia al pulsar JUGAR (política de autoplay).
- **Partículas de polvo** al rodar, deslizarse y aterrizar.
- **Motion blur leve** (afterimage) sólo durante el sprint.

### Subir a los techos
Salta a las **azoteas** (alcanzables directamente; el apex del salto ≈2.85 m
supera las azoteas ~1.8–2.5 m) y corre por encima esquivando el tráfico; hay
azoteas **encadenadas** para saltar de una a otra. La policía te sigue por el
suelo, así que las alturas son una ruta de escape.

### En teléfono / tablet 📱
Si se detecta pantalla táctil (o abres `?mobile=1`), aparece un **panel de botones**:
- **Pulgar izquierdo** (abajo-izquierda): **◀ / ▶** para el movimiento lateral (mantener).
- **Pulgar derecho** (abajo-derecha): **SALTAR** (tap), **AGACHAR** (mantener) y
  **SPRINT** (mantener) con su **aro de cooldown** encima.

Botones grandes, semitransparentes y separados; multitáctil real (mueves y saltas a la vez).
El juego se auto-adapta: **resolución tope + resolución dinámica** (baja el pixelRatio si
el fps cae y lo recupera con margen), **sombras reducidas** (1024) y menos luces de noche.
En **computadora** todo sigue igual con teclado (sin botones, calidad completa).

### Persecución policial 🚔
2 a 4 policías (mismo modelo humano riggeado, uniforme azul y gorra) te
persiguen. Si vas lento o **tropiezas** con un obstáculo, se acercan; si esquivas
y usas **sprint**, se alejan. Si te alcanzan, te atrapan (= muerte → checkpoint).
El HUD muestra un **radar + barra de proximidad**. La dificultad sube con la
distancia: policías más rápidos y más numerosos.

> Nota: chocar de lado con un obstáculo ya **no** mata al instante — te hace
> *tropezar* (te frena y la policía gana terreno). La muerte directa es **caer a
> un hueco** o que te **atrape la policía**.

### Ciclo día/noche 🌙
Cada `night.cycleDistance` metros (por defecto 850) el mundo transiciona
gradualmente día → noche → día (curva suave según la distancia). De noche:
- Cielo azul muy oscuro con bruma; niebla más cerrada = **visibilidad reducida**
  (los obstáculos fuera de la luz cuestan de ver).
- **Faroles** con luz cálida anaranjada que crean charcos de luz sobre el asfalto.
- **Ventanas** de los edificios encendidas en amarillo cálido (emissive, gratis).
- **Faros** de los carros encendidos (emissive) y pilotos traseros rojos.
- **El Ávila** queda como silueta apenas visible.
- Los policías llevan **linternas** (SpotLights que barren la escena) que te
  **deslumbran** cuando el cono te apunta de frente.
- Una **patrulla** al fondo con **sirena roja/azul** alternante que se refleja
  en el entorno.

**Rendimiento**: el nº de luces dinámicas está acotado (pool de faroles +
linternas + sirena ≈ 10, ninguna con sombra); ventanas/faros/letreros usan
**emissive maps** (coste ~0). Todo es tuneable en `CONFIG.night`.

---

## Personaje realista (Mixamo) — importante

El requisito visual es un **humano realista riggeado**, nunca primitivas.
El juego lo cumple así:

1. **Modelo:** carga `public/models/character.glb` (local) y si no existe, un
   personaje humano riggeado por CDN. Nunca se dibuja el jugador con cubos.
2. **Animaciones (flujo Mixamo):** el `AnimationSystem` busca clips de
   `run / jump / roll / slide / death / idle`, ya sea embebidos en el modelo o
   en GLB separados (`public/models/anim_*.glb`).
3. **Fallback honesto:** para cualquier animación que aún no hayas añadido, se
   aplica un fallback **procedural sobre el esqueleto real** (agacharse comprime
   las caderas, rodar gira el cuerpo, etc.). Así el juego es 100% jugable desde
   el minuto cero, y al soltar tus GLB de Mixamo pasa a **mocap real** solo.

**Para el set completo Mixamo** (recomendado para el look final):
descarga en https://www.mixamo.com un personaje humano realista + las animaciones
Running, Jump, Roll, Slide, Death, Idle; conviértelas a `.glb` (Blender / FBX2glTF)
y cópialas a `public/models/` con los nombres de `src/config.js`. Detalle en
`public/models/README.txt`.

> Nota de entorno: este proyecto no puede descargar de Mixamo automáticamente
> (requiere login de Adobe), por eso el pipeline está listo para que sueltes los
> archivos y todo se conecte solo.

---

## Arquitectura (para pedir las siguientes funciones sobre esta base)

Todo está separado por **sistemas** en su propio módulo. El `Game` los instancia
y los conecta; cada sistema expone una interfaz mínima.

```
src/
  config.js                 ← TODO lo tuneable + flags de features futuras
  main.js                   ← arranque + pantalla de carga
  core/
    Game.js                 ← orquestador: crea y conecta todos los sistemas
    Loop.js                 ← requestAnimationFrame con dt acotado
    AssetLoader.js          ← carga GLB con progreso y fallback
  systems/
    Input.js                ← teclado -> estado neutro (táctil escribirá aquí)
    Player.js               ← física ligera + máquina de estados de movimiento
    AnimationSystem.js      ← pipeline Mixamo: modelo GLB + clips + crossfade
    CameraSystem.js         ← 3ª persona con lerp, sigue el lateral
    WorldGenerator.js       ← corredor infinito: pool de chunks + hitos
    Chunk.js                ← segmento reciclable (suelo persistente, contenido regenerable)
    Collision.js            ← AABB según cómo se supera cada obstáculo
    Checkpoints.js          ← marcadores cada 300 m + reaparición
    Environment.js          ← cielo, niebla y El Ávila permanente
    Lighting.js             ← sol/hemisferio (hook setTimeOfDay para día/noche)
    PostProcessing.js       ← EffectComposer: bloom + SSAO opcional
  entities/
    BuildingFactory.js      ← edificios caraqueños (balcones, tanques de agua)
    CarFactory.js           ← carros realistas simplificados
    ObstacleFactory.js      ← obstáculos con metadato de "cómo superarlos"
    LandmarkFactory.js      ← Obelisco, El Silencio, Parque Central, Torre de David
  materials/
    ProceduralTextures.js   ← texturas PBR en canvas (+ normal maps)
    Materials.js            ← fábrica central de materiales (aquí se meten las reales)
  hud/
    HUD.js / hud.css        ← distancia, barra de sprint, toasts, pantalla de muerte
  future/                   ← módulos activables por flag (ver CONFIG.features)
    Police.js               ← IA de persecución (ACTIVA) — clona el rig del jugador
    DayNightCycle.js        ← ciclo día/noche + linternas (ACTIVO)
    MobileControls.js       ← botones táctiles (ACTIVO en táctil)
    LedgeGrab.js            ← agarre automático de bordes (ACTIVO)
  utils/
    Rng.js                  ← RNG determinista por chunk (mismo seed = mismo mundo)
```

### Flujo por frame (`Game._update(dt)`)
1. `Player.update` (input → movimiento/física, conduce animaciones)
2. `WorldGenerator.update` (recicla chunks), `Environment`/`Lighting` siguen al jugador
3. Features futuras (si activas): `DayNightCycle`, `Police`
4. `Checkpoints.update` + avisos de hitos
5. `Collision.check` + muerte por caída → pantalla de muerte
6. `CameraSystem.update` + `HUD.update`
7. `PostProcessing.render`

### Cómo activar una feature futura
En `src/config.js`, pon el flag en `true`:

```js
features: { police: true, dayNightCycle: true, mobileControls: true, ledgeGrab: true }
```

`Game._initFutureFeatures()` ya instancia y llama a cada módulo; solo hay que
completar los `TODO` dentro del stub correspondiente en `src/future/`.

### Rendimiento
- Niebla de distancia + `camera.far` acotado.
- **Object pooling de chunks**: la geometría de suelo persiste; solo se regenera
  el contenido al reciclar.
- Materiales y geometrías **compartidos/cacheados** (Materials.js, ProceduralTextures.js).
- `pixelRatio` limitado, sombras PCFSoft con cámara de sombra que sigue al jugador.
- Bloom sutil; SSAO **opcional** (`CONFIG.render.ssao`) por si la laptop lo aguanta.

---

## Criterios de aceptación cubiertos
1. ✅ Abre en navegador, loop a ~60 fps (pooling + materiales compartidos).
2. ✅ Personaje humano riggeado (GLB) con animaciones; jamás primitivas.
3. ✅ El Ávila siempre visible + hitos (Obelisco, El Silencio, Parque Central, Torre de David).
4. ✅ Correr, sprint con cooldown en HUD, salto, deslizarse, laterales, roll al aterrizar.
5. ✅ Muerte y reaparición en checkpoint.
6. ✅ Mundo infinito por chunks reciclados.
