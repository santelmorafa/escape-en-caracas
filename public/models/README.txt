Coloca aquí los modelos GLB del personaje.

El juego busca (ver src/config.js -> character.local):
  character.glb    -> modelo humano riggeado (base del personaje)
  anim_run.glb     -> animación de correr (Mixamo: Running)
  anim_jump.glb    -> salto (Mixamo: Jump)
  anim_roll.glb    -> rodar al aterrizar (Mixamo: Roll / Falling To Roll)
  anim_slide.glb   -> deslizarse/agacharse (Mixamo: Running Slide / Crouch)
  anim_death.glb   -> muerte (Mixamo: Death / Dying)
  anim_idle.glb    -> reposo (Mixamo: Idle)
  anim_capture.glb -> la policía te agarra (Mixamo: Grab / Punching / Tackle)

Si estos archivos NO están, el juego usa automáticamente un personaje humano
riggeado de arranque (Soldier.glb, cargado por CDN o por 'npm run fetch-assets')
y rellena las animaciones faltantes con fallbacks procedurales aplicados sobre
el esqueleto REAL (nunca primitivas).

Flujo Mixamo recomendado:
  1) https://www.mixamo.com  (cuenta Adobe gratuita)
  2) Elige un personaje humano realista.
  3) Descarga cada animación (Running, Jump, Roll, Slide, Death, Idle).
  4) Conviértelas a .glb (Blender o FBX2glTF) y renómbralas como arriba.
