import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Chunk } from './Chunk.js';
import { LandmarkFactory } from '../entities/LandmarkFactory.js';
import { rngForChunk, rand } from '../utils/Rng.js';

// =============================================================================
// WorldGenerator — orquesta el corredor infinito.
//  - Mantiene un POOL de chunks (chunksAhead + chunksBehind).
//  - A medida que el jugador avanza, recicla el chunk más atrasado hacia el
//    frente (reasignándole un nuevo índice y regenerando su contenido).
//  - Coloca hitos emblemáticos de Caracas a intervalos, repartidos en orden.
//  - Expone groundHeightAt() y getNearbyColliders() para físicas/colisión.
// =============================================================================

const W = CONFIG.world;

export class WorldGenerator {
  constructor(scene) {
    this.scene = scene;
    this.chunks = [];
    this.poolSize = W.chunksAhead + W.chunksBehind + 1;
    this.headIndex = 0;   // índice del chunk más adelantado generado
    this.lastLandmarkAt = 0;
    this.landmarkEvery = 5;      // cada ~5 chunks (200m) un hito
    this.landmarkCursor = 0;
    this.landmarkGroups = [];    // escenografía persistente de hitos

    for (let i = 0; i < this.poolSize; i++) {
      this.chunks.push(new Chunk(scene));
    }
  }

  init() {
    // generar los primeros chunks (desde detrás del jugador hacia delante)
    for (let i = 0; i < this.poolSize; i++) {
      this.chunks[i].generate(i);
    }
    this.headIndex = this.poolSize - 1;
    // sembrar algún hito temprano garantizado (para reconocer Caracas ya)
    this._placeLandmark(3);   // ~120m
    this._placeLandmark(6);   // ~240m
  }

  // Llamar cada frame con la posición Z del jugador.
  update(playerZ) {
    // índice del chunk donde está el jugador
    const playerChunk = Math.floor(-playerZ / W.chunkLength);

    // asegurar chunksAhead por delante
    while (this.headIndex < playerChunk + W.chunksAhead) {
      this._recycleFarthestBehind();
    }
  }

  _recycleFarthestBehind() {
    // reasignar el chunk de índice menor (el más atrasado) al frente
    let oldest = this.chunks[0];
    for (const c of this.chunks) if (c.index < oldest.index) oldest = c;

    this.headIndex++;
    oldest.generate(this.headIndex);

    // ¿toca un hito en este nuevo índice?
    if (this.headIndex - this.lastLandmarkAt >= this.landmarkEvery) {
      this._placeLandmark(this.headIndex);
    }
  }

  _placeLandmark(chunkIndex) {
    this.lastLandmarkAt = chunkIndex;
    const kind = LandmarkFactory.order[this.landmarkCursor % LandmarkFactory.order.length];
    this.landmarkCursor++;

    const g = LandmarkFactory.create(kind);
    const rng = rngForChunk(W.seed ^ 0xABCD, chunkIndex);
    const side = rand.chance(rng, 0.5) ? -1 : 1;
    // detrás de la línea de edificios, como fondo urbano reconocible
    const x = side * (W.roadWidth / 2 + W.sidewalkWidth + 30 + rand.range(rng, 0, 20));
    const z = -chunkIndex * W.chunkLength - W.chunkLength / 2;
    g.position.set(x, 0, z);
    g.rotation.y = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    this.scene.add(g);
    this.landmarkGroups.push({ group: g, kind, z });

    // limitar cuántos hitos persisten (limpiar los muy atrasados)
    if (this.landmarkGroups.length > 6) {
      const old = this.landmarkGroups.shift();
      this.scene.remove(old.group);
    }
    return { kind, label: LandmarkFactory.labels[kind], z };
  }

  // Hito cercano por delante que el jugador está a punto de pasar (para avisos).
  getApproachingLandmark(playerZ, withinMeters = 60) {
    for (const lm of this.landmarkGroups) {
      const dist = playerZ - lm.z; // positivo si el hito está por delante (z menor)
      if (dist > 0 && dist < withinMeters && !lm.announced) {
        lm.announced = true;
        return { label: LandmarkFactory.labels[lm.kind] };
      }
    }
    return null;
  }

  groundHeightAt(x, z) {
    for (const c of this.chunks) {
      if (c.active && c.containsZ(z)) return c.groundHeightAt(x, z);
    }
    return 0; // fuera de chunks activos: suelo por defecto
  }

  // Superficie transitable (suelo, tope de obstáculo o azotea). Ver Chunk.
  surfaceHeightAt(x, z, feetY = 0, step = 0) {
    for (const c of this.chunks) {
      if (c.active && c.containsZ(z)) return c.surfaceHeightAt(x, z, feetY, step);
    }
    return 0;
  }

  getNearbyColliders(z, range = 30) {
    const out = [];
    for (const c of this.chunks) {
      if (!c.active) continue;
      if (Math.abs(c.zStart - z) > range + W.chunkLength) continue;
      for (const col of c.colliders) out.push(col);
    }
    return out;
  }

  // Superficies transitables cercanas (topes de azoteas/obstáculos) para el
  // agarre de bordes. Devuelve [{xMin,xMax,zMin,zMax,top}].
  getNearbySurfaces(z, range = 8) {
    const out = [];
    for (const c of this.chunks) {
      if (!c.active) continue;
      if (Math.abs(c.zStart - z) > range + W.chunkLength) continue;
      for (const s of c.surfaces) out.push(s);
    }
    return out;
  }
}
