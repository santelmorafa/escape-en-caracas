// =============================================================================
// fetch-assets.mjs — descarga al PROYECTO un personaje humano riggeado real
// (para no depender del CDN en tiempo de juego). Ejecuta:  npm run fetch-assets
//
// Descarga Soldier.glb (modelo humano con esqueleto + animaciones Idle/Walk/Run,
// asset de ejemplo de three.js, licencia permisiva) en public/models/character.glb.
//
// Para el SET COMPLETO estilo Mixamo (Running, Jump, Roll, Slide, Death):
//   1) Entra a https://www.mixamo.com (cuenta Adobe gratuita).
//   2) Elige un personaje humano realista (p.ej. "Y Bot" ya no; usa un escaneo
//      humano o un personaje realista del catálogo).
//   3) Descarga cada animación como "FBX for Unity" o glTF; conviértela a .glb
//      (con https://github.com/facebookincubator/FBX2glTF o Blender).
//   4) Copia los .glb a public/models con estos nombres (ver src/config.js):
//        character.glb, anim_run.glb, anim_jump.glb, anim_roll.glb,
//        anim_slide.glb, anim_death.glb, anim_idle.glb
//   El AnimationSystem los detecta y los usa automáticamente (mocap real),
//   reemplazando los fallbacks procedurales.
// =============================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('public/models');

const DOWNLOADS = [
  {
    name: 'character.glb',
    url: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    desc: 'Personaje humano riggeado (Idle/Walk/Run incluidos)'
  }
];

async function download({ name, url, desc }) {
  const dest = path.join(OUT_DIR, name);
  process.stdout.write(`↓ ${name}  (${desc}) … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  console.log('Descargando assets de arranque a public/models …\n');
  for (const d of DOWNLOADS) {
    try { await download(d); }
    catch (e) { console.log(`FALLÓ: ${e.message}`); }
  }
  console.log('\nListo. Para el set completo de animaciones Mixamo, revisa las');
  console.log('instrucciones en la cabecera de scripts/fetch-assets.mjs.');
}

main();
