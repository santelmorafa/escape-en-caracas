import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Materials } from '../materials/Materials.js';
import { BuildingFactory } from '../entities/BuildingFactory.js';
import { ObstacleFactory } from '../entities/ObstacleFactory.js';
import { PropFactory } from '../entities/PropFactory.js';
import { rand } from '../utils/Rng.js';

// =============================================================================
// Chunk — un segmento del corredor urbano. Se REUTILIZA (object pooling):
// la geometría de suelo persiste; sólo se regeneran edificios y obstáculos al
// reciclarse. Cada chunk expone sus colliders y huecos en coordenadas de mundo.
//
// Convención: "adelante" es -Z. El chunk `index` ocupa z ∈ [-i*L, -(i+1)*L].
// =============================================================================

const W = CONFIG.world;

// Geometrías compartidas (creadas una vez)
const roadGeo = new THREE.PlaneGeometry(W.roadWidth, W.chunkLength, 1, 1);
const walkGeo = new THREE.PlaneGeometry(W.sidewalkWidth, W.chunkLength, 1, 1);
const curbGeo = new THREE.BoxGeometry(0.3, 0.35, W.chunkLength);
const lampGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 8);
const voidGeo = new THREE.BoxGeometry(1, 1, 1);

export class Chunk {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.index = -1;
    this.zStart = 0;

    // ---- suelo persistente ----
    this.road = new THREE.Mesh(roadGeo, Materials.asphalt());
    this.road.rotation.x = -Math.PI / 2;
    this.road.receiveShadow = true;
    this.group.add(this.road);

    this.walks = [];
    this.curbs = [];
    for (const sx of [-1, 1]) {
      const walk = new THREE.Mesh(walkGeo, Materials.sidewalk());
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(sx * (W.roadWidth / 2 + W.sidewalkWidth / 2), 0.18, 0);
      walk.receiveShadow = true;
      this.group.add(walk);
      this.walks.push(walk);

      const curb = new THREE.Mesh(curbGeo, Materials.concrete(0xb0a894));
      curb.position.set(sx * (W.roadWidth / 2 + 0.15), 0.17, 0);
      curb.receiveShadow = true; curb.castShadow = true;
      this.group.add(curb);
      this.curbs.push(curb);
    }

    // contenedor de contenido regenerable (edificios/obstáculos/props)
    this.content = new THREE.Group();
    this.group.add(this.content);

    // pozo/vacío visual bajo los huecos
    this.voidMesh = new THREE.Mesh(voidGeo, new THREE.MeshBasicMaterial({ color: 0x05060a }));
    this.voidMesh.visible = false;
    this.group.add(this.voidMesh);

    // datos de juego
    this.colliders = [];   // [{pass, box:Box3(mundo)}]
    this.pits = [];        // [{xMin,xMax,zMin,zMax}]
    this.surfaces = [];    // [{xMin,xMax,zMin,zMax,top}] superficies transitables
    this._roofZones = [];  // z ocupadas por azoteas (para no chocar obstáculos)
    this.landmarkLabel = null;
    this.active = false;
  }

  _clearContent() {
    for (let i = this.content.children.length - 1; i >= 0; i--) {
      this.content.remove(this.content.children[i]);
    }
    this.colliders.length = 0;
    this.pits.length = 0;
    this.surfaces.length = 0;
    this._roofZones.length = 0;
    this.landmarkLabel = null;
    this.voidMesh.visible = false;
    this.road.visible = true;
  }

  _addSurfaceFromWorldBox(box) {
    this.surfaces.push({
      xMin: box.min.x, xMax: box.max.x,
      zMin: box.min.z, zMax: box.max.z,
      top: box.max.y
    });
  }

  // Regenera el contenido del chunk para un índice dado (determinista).
  generate(index) {
    this.index = index;
    this.zStart = -index * W.chunkLength;
    this.group.position.z = this.zStart - W.chunkLength / 2; // centro del segmento
    this._clearContent();
    this.active = true;

    const rng = _rngForChunk(W.seed, index);

    this._buildStreetProps(rng);
    this._buildBuildings(rng);

    const isWarmup = index < W.warmupChunks;
    this._buildStreetFurniture(rng, isWarmup);
    if (!isWarmup) {
      this._buildRooftops(rng);
      this._buildPit(rng);
      this._buildObstacles(rng);
    }
  }

  // Mobiliario urbano en las aceras: palmeras, bancos y alguna valla.
  _buildStreetFurniture(rng, isWarmup) {
    const walkX = W.roadWidth / 2 + W.sidewalkWidth * 0.5;
    for (const sx of [-1, 1]) {
      if (rand.chance(rng, 0.6)) {
        const prop = rand.chance(rng, 0.6) ? PropFactory.palm(rng) : PropFactory.bench(rng);
        prop.position.set(sx * walkX, 0.18, rand.range(rng, -W.chunkLength / 2 + 4, W.chunkLength / 2 - 4));
        this.content.add(prop);
      }
    }
    if (!isWarmup && rand.chance(rng, 0.18)) {
      const bb = PropFactory.billboard(rng);
      const sx = rand.chance(rng, 0.5) ? -1 : 1;
      bb.position.set(sx * (W.roadWidth / 2 + W.sidewalkWidth + 2), 0, rand.range(rng, -12, 12));
      bb.rotation.y = sx < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      this.content.add(bb);
    }
  }

  _localToWorldZ(localZ) {
    // localZ ∈ [-L/2, L/2] centrado -> z mundo
    return this.group.position.z + localZ;
  }

  _buildStreetProps(rng) {
    // farolas a ambos lados (geometría compartida)
    const lampMat = Materials.metal(0x3d4148);
    const n = 2;
    for (let i = 0; i < n; i++) {
      const lz = -W.chunkLength / 2 + (i + 0.5) * (W.chunkLength / n);
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(lampGeo, lampMat);
        pole.position.set(sx * (W.roadWidth / 2 + 1.2), 2.5, lz);
        pole.castShadow = true;
        this.content.add(pole);
        const arm = new THREE.Mesh(voidGeo, lampMat);
        arm.scale.set(1.4, 0.12, 0.12);
        arm.position.set(sx * (W.roadWidth / 2 + 0.6), 4.9, lz);
        this.content.add(arm);
      }
    }
  }

  _buildBuildings(rng) {
    const depth = 14;
    for (const sx of [-1, 1]) {
      // 1-2 edificios por lado por chunk
      const count = rand.int(rng, 1, 2);
      const seg = W.chunkLength / count;
      for (let i = 0; i < count; i++) {
        const width = rand.range(rng, seg * 0.6, seg * 0.92);
        const b = BuildingFactory.create(rng, { width, depth });
        const lz = -W.chunkLength / 2 + (i + 0.5) * seg;
        b.position.set(
          sx * (W.roadWidth / 2 + W.sidewalkWidth + depth / 2),
          0,
          lz
        );
        this.content.add(b);
      }
    }
  }

  _buildPit(rng) {
    if (!rand.chance(rng, W.pitChance)) return;
    // hueco en la vía: franja que hay que saltar (no cubre todo el ancho salvo a veces)
    const full = rand.chance(rng, 0.5);
    const pitLen = rand.range(rng, 3.5, 6.0);
    const localZc = rand.range(rng, -W.chunkLength / 2 + 8, W.chunkLength / 2 - 8);
    const zc = this._localToWorldZ(localZc);
    const zMin = zc - pitLen / 2, zMax = zc + pitLen / 2;

    let xMin, xMax;
    if (full) {
      xMin = -W.roadWidth / 2; xMax = W.roadWidth / 2;
    } else {
      const side = rand.chance(rng, 0.5) ? -1 : 1;
      const w = rand.range(rng, 6, 10);
      if (side < 0) { xMin = -W.roadWidth / 2; xMax = xMin + w; }
      else { xMax = W.roadWidth / 2; xMin = xMax - w; }
    }
    this.pits.push({ xMin, xMax, zMin, zMax });

    // visual: oscurecer la zona (mostrar el vacío). Como el road es un solo plano,
    // colocamos una caja negra hundida para dar sensación de profundidad.
    const vw = xMax - xMin, vl = pitLen;
    this.voidMesh.visible = true;
    this.voidMesh.scale.set(vw, 6, vl);
    this.voidMesh.position.set((xMin + xMax) / 2, -3.1, localZc);
    // borde de peligro
    // (el propio hueco en el asfalto lo insinúa el material oscuro del void)
  }

  _buildObstacles(rng) {
    // colocamos hasta 3 "slots" a lo largo del chunk, dejando SIEMPRE una vía
    // superable (nunca bloquear los 3 carriles con obstáculos 'around').
    const slots = 3;
    for (let s = 0; s < slots; s++) {
      if (!rand.chance(rng, W.obstacleDensity)) continue;
      const localZ = -W.chunkLength / 2 + (s + 0.5) * (W.chunkLength / slots)
        + rand.range(rng, -3, 3);
      const zc = this._localToWorldZ(localZ);

      // no solapar con huecos ni con azoteas
      if (this.pits.some(p => zc > p.zMin - 3 && zc < p.zMax + 3)) continue;
      if (this._roofZones.some(r => zc > r.zMin && zc < r.zMax)) continue;

      const type = rand.pick(rng, ObstacleFactory.types);
      const { group, colliders } = ObstacleFactory.create(rng, type);

      // posición lateral: 'around' se pega a un costado para poder esquivar;
      // 'over'/'under' pueden ir centrados.
      let x;
      const pass = colliders[0]?.pass;
      if (pass === 'around') {
        x = (rand.chance(rng, 0.5) ? -1 : 1) * rand.range(rng, 3.5, 6.5);
      } else {
        x = rand.range(rng, -4, 4);
      }
      group.position.set(x, 0, localZ);
      this.content.add(group);

      // colliders -> mundo
      for (const c of colliders) {
        const wb = c.box.clone();
        const offset = new THREE.Vector3(x, 0, zc);
        wb.min.add(offset); wb.max.add(offset);
        this.colliders.push({ pass: c.pass, box: wb });
        // su tope es una superficie sobre la que se puede caer/pararse
        this._addSurfaceFromWorldBox(wb);
      }
    }
  }

  // Azotea baja transitable: una plataforma a un costado del corredor a la que
  // el jugador puede SUBIRSE de un salto y correr por encima, esquivando el
  // tráfico de abajo. Alcanzable directamente con el salto (apex ~2.8 m).
  _buildRooftops(rng) {
    if (!rand.chance(rng, W.rooftopChance)) return;
    const side = rand.chance(rng, 0.5) ? -1 : 1;
    const height = rand.range(rng, 1.8, 2.4);
    const width = rand.range(rng, 4.0, 5.5);
    const length = rand.range(rng, 12, 20);
    const localZc = rand.range(rng, -W.chunkLength / 2 + length / 2 + 2,
      W.chunkLength / 2 - length / 2 - 2);
    this._makeRooftop(rng, side, height, width, length, localZc);

    // a veces una SEGUNDA azotea contigua (misma lado) para saltar de techo en
    // techo — parkour por las alturas.
    if (rand.chance(rng, 0.4)) {
      const gap = rand.range(rng, 3.5, 5.5);
      const len2 = rand.range(rng, 8, 13);
      const z2 = localZc - length / 2 - gap - len2 / 2;
      if (z2 - len2 / 2 > -W.chunkLength / 2 + 1) {
        this._makeRooftop(rng, side, height + rand.range(rng, -0.3, 0.6),
          rand.range(rng, 3.5, 5), len2, z2);
      }
    }
  }

  _makeRooftop(rng, side, height, width, length, localZc) {
    const cx = side * (W.roadWidth / 2 - width / 2 - 0.3);
    const zc = this._localToWorldZ(localZc);

    const body = new THREE.Mesh(voidGeo, Materials.facade(rand.int(rng, 0, 8)));
    body.scale.set(width, height, length);
    body.position.set(cx, height / 2, localZc);
    body.castShadow = true; body.receiveShadow = true;
    this.content.add(body);
    const slab = new THREE.Mesh(voidGeo, Materials.concrete(0x8f8a80));
    slab.scale.set(width + 0.4, 0.25, length + 0.4);
    slab.position.set(cx, height + 0.12, localZc);
    slab.castShadow = true; slab.receiveShadow = true;
    this.content.add(slab);
    const parapetMat = Materials.concrete(0xa79f90);
    const px = width / 2 - 0.1;
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(voidGeo, parapetMat);
      rail.scale.set(0.2, 0.5, length);
      rail.position.set(cx + sx * px, height + 0.4, localZc);
      rail.castShadow = true;
      this.content.add(rail);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 10), Materials.waterTank());
    tank.position.set(cx + (side < 0 ? 1 : -1), height + 0.85, localZc + length * 0.3);
    tank.castShadow = true;
    this.content.add(tank);

    const box = new THREE.Box3(
      new THREE.Vector3(cx - width / 2, 0, zc - length / 2),
      new THREE.Vector3(cx + width / 2, height, zc + length / 2)
    );
    this.colliders.push({ pass: 'around', box });
    this.surfaces.push({
      xMin: cx - width / 2, xMax: cx + width / 2,
      zMin: zc - length / 2, zMax: zc + length / 2,
      top: height + 0.24
    });
    this._roofZones.push({ zMin: zc - length / 2 - 3, zMax: zc + length / 2 + 3 });
  }

  // Altura del suelo en (x,z). null = vacío (hueco) -> caída.
  groundHeightAt(x, z) {
    for (const p of this.pits) {
      if (x >= p.xMin && x <= p.xMax && z <= p.zMax && z >= p.zMin) return null;
    }
    return 0;
  }

  // Altura de la superficie transitable en (x,z) que NO esté por encima de
  // feetY+step (para poder pararse o subir un escalón). Considera el suelo (0),
  // los huecos (null) y los topes de obstáculos/azoteas. Devuelve la más alta
  // alcanzable, o null si sólo hay vacío bajo los pies.
  surfaceHeightAt(x, z, feetY, step) {
    let best = this.groundHeightAt(x, z); // 0 (suelo) o null (hueco)
    const reach = feetY + step + 0.001;
    for (const s of this.surfaces) {
      if (x < s.xMin || x > s.xMax || z < s.zMin || z > s.zMax) continue;
      if (s.top > reach) continue;                 // demasiado alto para alcanzarlo
      best = best === null ? s.top : Math.max(best, s.top);
    }
    return best;
  }

  containsZ(z) {
    const front = this.zStart;              // borde trasero (mayor z)
    const back = this.zStart - W.chunkLength;
    return z <= front && z >= back;
  }

  deactivate() {
    this.active = false;
    this.group.visible = false;
  }

  activate() {
    this.group.visible = true;
  }
}

// --- enlace a util (evita import circular arriba) ---
import { rngForChunk as _rngForChunk } from '../utils/Rng.js';
