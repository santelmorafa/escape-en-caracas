import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Materials } from '../materials/Materials.js';
import { PropFactory } from '../entities/PropFactory.js';
import { ObstacleFactory } from '../entities/ObstacleFactory.js';
import { LandmarkFactory } from '../entities/LandmarkFactory.js';
import { rand } from '../utils/Rng.js';
import { mulberry32 } from '../utils/Rng.js';

// =============================================================================
// Tile — una MANZANA de la ciudad (rejilla 2D). Contiene un edificio (o plaza /
// mercado / hito) rodeado de calle. Los edificios son SÓLIDOS y CLIMBABLES:
// se construyen como torres escalonadas (cada terraza es un borde saltable), de
// modo que puedes subirte de terraza en terraza hasta la azotea.
// Guarda sus colliders y superficies en coordenadas de MUNDO.
// =============================================================================

const C = CONFIG.city;
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const lampGeo = new THREE.CylinderGeometry(0.09, 0.11, 5, 8);

export class Tile {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.content = this.group;
    this.gi = null; this.gj = null;
    this.cx = 0; this.cz = 0;
    this.colliders = [];
    this.surfaces = [];
    this.ladders = [];       // [{bx,bz,tx,tz,topY,nx,nz}] escaleras trepables
    this.landmark = null;
    this.active = false;
  }

  _clear() {
    for (let i = this.group.children.length - 1; i >= 0; i--) this.group.remove(this.group.children[i]);
    this.colliders.length = 0;
    this.surfaces.length = 0;
    this.ladders.length = 0;
    this.landmark = null;
  }

  _rng() { return mulberry32((C.seed ^ (this.gi * 73856093) ^ (this.gj * 19349663)) >>> 0); }

  // Tipo de manzana en (gi,gj) SIN construir nada (para el mapa del menú).
  // Debe reflejar la misma decisión que generate().
  static typeAt(gi, gj) {
    if (gi === 0 && gj === 0) return 'plaza';
    if (Math.abs(gi * 31 + gj * 17) % 13 === 0) return 'landmark';
    const rng = mulberry32((C.seed ^ (gi * 73856093) ^ (gj * 19349663)) >>> 0);
    const roll = rng();
    if (roll < 0.24) return 'tower';
    if (roll < 0.44) return 'slab';
    if (roll < 0.58) return 'round';
    if (roll < 0.70) return 'twin';
    if (roll < 0.82) return 'lowblock';
    if (roll < 0.92) return 'plaza';
    return 'market';
  }

  generate(gi, gj) {
    this.gi = gi; this.gj = gj;
    this.active = true;
    this.group.visible = true;
    this._clear();
    const rng = this._rng();
    const ox = gi * C.tileSize, oz = gj * C.tileSize;
    this.cx = ox + C.tileSize / 2;
    this.cz = oz + C.tileSize / 2;

    // farola en la esquina de la manzana (rejilla de postes en las esquinas)
    const post = new THREE.Mesh(lampGeo, Materials.metal(0x3d4148));
    post.position.set(ox, 2.5, oz); post.castShadow = true;
    this.group.add(post);

    // ¿hito emblemático en esta manzana?
    const h = Math.abs((gi * 31 + gj * 17)) % 13;
    if (h === 0 && !(gi === 0 && gj === 0)) {
      this._buildLandmark(gi, gj);
      return;
    }

    const roll = rng();
    if (gi === 0 && gj === 0) this._buildPlaza(rng);           // manzana de inicio: plaza abierta
    else if (roll < 0.24) this._buildTower(rng);               // torre escalonada (pirámide)
    else if (roll < 0.44) this._buildSlab(rng);                // torre recta (con escalera)
    else if (roll < 0.58) this._buildRound(rng);               // torre cilíndrica (con escalera)
    else if (roll < 0.70) this._buildTwin(rng);                // dos bloques + puente/escaleras
    else if (roll < 0.82) this._buildLowBlock(rng);
    else if (roll < 0.92) this._buildPlaza(rng);
    else this._buildMarket(rng);
  }

  _addSolid(cx, cz, w, d, top) {
    this.colliders.push({ pass: 'wall', box: new THREE.Box3(
      new THREE.Vector3(cx - w / 2, 0, cz - d / 2), new THREE.Vector3(cx + w / 2, top, cz + d / 2)) });
  }
  _addSurface(cx, cz, w, d, top) {
    this.surfaces.push({ xMin: cx - w / 2, xMax: cx + w / 2, zMin: cz - d / 2, zMax: cz + d / 2, top });
  }

  // Barra (riel/travesaño) entre dos puntos, orientada con quaternion.
  _bar(mat, a, b, thick) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const L = Math.hypot(dx, dy, dz) || 0.01;
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(thick, L, thick);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    m.castShadow = true;
    this.group.add(m);
  }

  // Escalera TREPABLE (vertical o apoyada): rieles + travesaños. Base en (bx,bz),
  // cima en (tx,tz,topY). (nx,nz) = normal hacia afuera de la pared. Registra el
  // dato para que el jugador pueda trepar (Player STATE.LADDER).
  _addLadder(bx, bz, tx, tz, topY, nx, nz) {
    const mat = Materials.metal(0x6a6f77);
    const sx = nz * 0.32, sz = -nx * 0.32;   // separación lateral de los rieles
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    this._bar(mat, V(bx + sx, 0, bz + sz), V(tx + sx, topY, tz + sz), 0.08);
    this._bar(mat, V(bx - sx, 0, bz - sz), V(tx - sx, topY, tz - sz), 0.08);
    const rungs = Math.max(3, Math.floor(topY / 0.5));
    for (let i = 1; i < rungs; i++) {
      const t = i / rungs;
      const rx = bx + (tx - bx) * t, ry = topY * t, rz = bz + (tz - bz) * t;
      this._bar(mat, V(rx + sx, ry, rz + sz), V(rx - sx, ry, rz - sz), 0.055);
    }
    this.ladders.push({ bx, bz, tx, tz, topY, nx, nz });
  }

  // Escalera APOYADA que SIEMPRE llega a algo transitable: sube desde el pie en
  // la calle hasta una plataforma/balcón al tope, contra la pared (wx,wz) de
  // altura wallTop. Así, si existe una escalera apoyada, lleva a un sitio para
  // continuar (el balcón conecta con la azotea).
  _addLeaningLadder(wx, wz, wallTop, nx, nz) {
    const topY = Math.max(3, Math.min(wallTop, 22));
    const fx = wx + nx * 3.2, fz = wz + nz * 3.2;     // pie separado del muro
    const tx = wx + nx * 0.45, tz = wz + nz * 0.45;   // tope apoyado en la pared
    this._addLadder(fx, fz, tx, tz, topY, nx, nz);
    // plataforma de aterrizaje (balcón) al tope, sobresaliendo del muro
    const px = wx + nx * 0.7, pz = wz + nz * 0.7;
    const w = nx !== 0 ? 1.6 : 2.6, d = nz !== 0 ? 1.6 : 2.6;
    const plat = new THREE.Mesh(boxGeo, Materials.concrete(0x9a958c));
    plat.scale.set(w, 0.25, d); plat.position.set(px, topY - 0.12, pz);
    plat.castShadow = true; plat.receiveShadow = true;
    this.group.add(plat);
    // baranda del balcón
    const rail = new THREE.Mesh(boxGeo, Materials.metal(0x555a60));
    rail.scale.set(w, 0.5, 0.08);
    rail.position.set(px + nx * (d / 2), topY + 0.25, pz + nz * (d / 2));
    if (nx !== 0) rail.rotation.y = Math.PI / 2;
    this.group.add(rail);
    this._addSolid(px, pz, w, d, topY);
    this._addSurface(px, pz, w, d, topY);
  }

  // Escalera NORMAL (caminable): escalones sólidos que suben hasta topY. Desde el
  // borde (ex,ez) bajan hacia afuera en (ox,oz). Se sube andando (step-up).
  _buildStairs(ex, ez, ox, oz, topY) {
    const rise = 0.5, run = 0.72;
    const n = Math.max(2, Math.ceil(topY / rise));
    const mat = Materials.concrete(0x9a958c);
    for (let k = 0; k < n; k++) {
      const y = topY - k * rise;
      if (y <= 0.05) break;
      const px = ex + ox * (k * run + run / 2);
      const pz = ez + oz * (k * run + run / 2);
      const w = ox !== 0 ? run : 3.0, d = oz !== 0 ? run : 3.0;
      const step = new THREE.Mesh(boxGeo, mat);
      step.scale.set(w, y, d); step.position.set(px, y / 2, pz);
      step.castShadow = true; step.receiveShadow = true;
      this.group.add(step);
      this._addSolid(px, pz, w, d, y);
      this._addSurface(px, pz, w, d, y);
    }
  }

  // Torre recta (no pirámide) con escalera vertical en una pared.
  _buildSlab(rng) {
    const w = rand.range(rng, 10, 16), d = rand.range(rng, 10, 16);
    const h = rand.range(rng, 9, 22);
    const m = new THREE.Mesh(boxGeo, Materials.facade(rand.int(rng, 0, 8)));
    m.scale.set(w, h, d); m.position.set(this.cx, h / 2, this.cz);
    m.castShadow = true; m.receiveShadow = true;
    this.group.add(m);
    this._addSolid(this.cx, this.cz, w, d, h);
    this._addSurface(this.cx, this.cz, w, d, h);
    const tank = new THREE.Mesh(cylGeo, Materials.waterTank());
    tank.scale.set(0.8, 1.4, 0.8); tank.position.set(this.cx, h + 0.7, this.cz); tank.castShadow = true;
    this.group.add(tank);
    // escalera para subir a la azotea: a veces vertical, a veces APOYADA
    const s = rand.chance(rng, 0.5) ? 1 : -1;
    if (rand.chance(rng, 0.5)) {
      // apoyada contra una pared, con balcón arriba
      if (rand.chance(rng, 0.5)) this._addLeaningLadder(this.cx + s * (w / 2), this.cz, h, s, 0);
      else this._addLeaningLadder(this.cx, this.cz + s * (d / 2), h, 0, s);
    } else {
      // vertical pegada a la pared
      if (rand.chance(rng, 0.5)) this._addLadder(this.cx + s * (w / 2 + 0.5), this.cz, this.cx + s * (w / 2 + 0.5), this.cz, h, s, 0);
      else this._addLadder(this.cx, this.cz + s * (d / 2 + 0.5), this.cx, this.cz + s * (d / 2 + 0.5), h, 0, s);
    }
  }

  // Torre cilíndrica con escalera ligeramente apoyada.
  _buildRound(rng) {
    const r = rand.range(rng, 6, 9), h = rand.range(rng, 9, 20);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 16), Materials.facade(rand.int(rng, 0, 8)));
    body.position.set(this.cx, h / 2, this.cz); body.castShadow = true; body.receiveShadow = true;
    this.group.add(body);
    this._addSolid(this.cx, this.cz, r * 1.75, r * 1.75, h);
    this._addSurface(this.cx, this.cz, r * 1.5, r * 1.5, h);
    const tank = new THREE.Mesh(cylGeo, Materials.waterTank());
    tank.scale.set(0.7, 1.2, 0.7); tank.position.set(this.cx, h + 0.6, this.cz); tank.castShadow = true;
    this.group.add(tank);
    this._addLadder(this.cx, this.cz + r + 0.6, this.cx, this.cz + r * 0.92, h, 0, 1);
  }

  // Dos bloques con callejón: escaleras normales a uno y escalera apoyada al otro.
  _buildTwin(rng) {
    const w = rand.range(rng, 7, 9), d = rand.range(rng, 10, 16);
    const gap = rand.range(rng, 4, 7);
    const h1 = rand.range(rng, 7, 14), h2 = rand.range(rng, 8, 16);
    const lbx = this.cx - (gap / 2 + w / 2), rbx = this.cx + (gap / 2 + w / 2);
    for (const [bx, hh] of [[lbx, h1], [rbx, h2]]) {
      const m = new THREE.Mesh(boxGeo, Materials.facade(rand.int(rng, 0, 8)));
      m.scale.set(w, hh, d); m.position.set(bx, hh / 2, this.cz);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      this._addSolid(bx, this.cz, w, d, hh);
      this._addSurface(bx, this.cz, w, d, hh);
    }
    // escaleras normales (caminables) al bloque izquierdo (borde frontal -z)
    this._buildStairs(lbx, this.cz - d / 2 - 0.4, 0, -1, h1);
    // escalera APOYADA al bloque derecho, con balcón arriba para continuar
    this._addLeaningLadder(rbx + w / 2, this.cz, h2, 1, 0);
  }

  // Torre escalonada (climbable): cada terraza es más pequeña -> deja un borde.
  _buildTower(rng) {
    const maxW = C.tileSize - C.streetWidth - C.sidewalk * 2;
    const tiers = rand.int(rng, 3, 7);
    const variant = rand.int(rng, 0, 8);
    let y = 0, w = maxW;
    for (let k = 0; k < tiers; k++) {
      const th = rand.range(rng, C.tierHeight[0], C.tierHeight[1]);
      const m = new THREE.Mesh(boxGeo, Materials.facade(variant));
      m.scale.set(w, th, w); m.position.set(this.cx, y + th / 2, this.cz);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      const top = y + th;
      this._addSolid(this.cx, this.cz, w, w, top);
      this._addSurface(this.cx, this.cz, w, w, top);
      y = top;
      w -= C.tierSetback * 2;
      if (w < 9) break;
    }
    // tanque de agua en la azotea
    const tank = new THREE.Mesh(cylGeo, Materials.waterTank());
    tank.scale.set(0.8, 1.4, 0.8); tank.position.set(this.cx, y + 0.7, this.cz); tank.castShadow = true;
    this.group.add(tank);
    // valla emissive de vez en cuando
    if (rand.chance(rng, 0.3)) {
      const sw = w + C.tierSetback * 2;
      const sign = new THREE.Mesh(boxGeo, Materials.sign(rand.pick(rng, [0xffcf5a, 0xff5a4d, 0x2fb0d8, 0x53c07a])));
      sign.scale.set(Math.max(4, sw * 0.8), sw * 0.35, 0.3);
      sign.position.set(this.cx, y + sw * 0.2, this.cz);
      this.group.add(sign);
    }
  }

  _buildLowBlock(rng) {
    const w = C.tileSize - C.streetWidth - C.sidewalk * 2;
    const hgt = rand.range(rng, 2.4, 3.2);
    const m = new THREE.Mesh(boxGeo, Materials.facade(rand.int(rng, 0, 8)));
    m.scale.set(w, hgt, w); m.position.set(this.cx, hgt / 2, this.cz);
    m.castShadow = true; m.receiveShadow = true;
    this.group.add(m);
    this._addSolid(this.cx, this.cz, w, w, hgt);
    this._addSurface(this.cx, this.cz, w, w, hgt);
    // props en la azotea
    const tank = new THREE.Mesh(cylGeo, Materials.waterTank());
    tank.scale.set(0.7, 1.2, 0.7); tank.position.set(this.cx + 2, hgt + 0.6, this.cz - 2); tank.castShadow = true;
    this.group.add(tank);
  }

  _buildPlaza(rng) {
    // espacio abierto: fuente baja (climbable) + palmeras y bancos
    const fMat = Materials.concrete(0xbfb6a4);
    const fountain = new THREE.Mesh(cylGeo, fMat);
    fountain.scale.set(3, 0.7, 3); fountain.position.set(this.cx, 0.35, this.cz); fountain.castShadow = true;
    this.group.add(fountain);
    this._addSolid(this.cx, this.cz, 6, 6, 0.7);
    this._addSurface(this.cx, this.cz, 6, 6, 0.7);
    const spots = rand.int(rng, 3, 5);
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * Math.PI * 2;
      const r = C.tileSize * 0.28;
      const prop = rand.chance(rng, 0.6) ? PropFactory.palm(rng) : PropFactory.bench(rng);
      prop.position.set(this.cx + Math.cos(a) * r, 0, this.cz + Math.sin(a) * r);
      this.group.add(prop);
    }
  }

  _buildMarket(rng) {
    const n = rand.int(rng, 3, 5);
    const span = (C.tileSize - C.streetWidth) * 0.5;
    for (let i = 0; i < n; i++) {
      const { group, colliders } = ObstacleFactory.create(rng, rand.chance(rng, 0.5) ? 'kiosk' : 'container');
      const ox = rand.range(rng, -span, span), oz = rand.range(rng, -span, span);
      group.position.set(this.cx + ox, 0, this.cz + oz);
      this.group.add(group);
      for (const c of colliders) {
        const b = c.box.clone();
        b.min.add(new THREE.Vector3(this.cx + ox, 0, this.cz + oz));
        b.max.add(new THREE.Vector3(this.cx + ox, 0, this.cz + oz));
        this.colliders.push({ pass: c.pass, box: b });
        this.surfaces.push({ xMin: b.min.x, xMax: b.max.x, zMin: b.min.z, zMax: b.max.z, top: b.max.y });
      }
    }
  }

  _buildLandmark(gi, gj) {
    const kind = LandmarkFactory.order[Math.abs(gi + gj) % LandmarkFactory.order.length];
    const g = LandmarkFactory.create(kind);
    g.position.set(this.cx, 0, this.cz);
    this.group.add(g);
    this.landmark = { label: LandmarkFactory.labels[kind] };
    // collider sólido aproximado (no climbable)
    const half = 9, top = (g.userData.height || 30);
    this._addSolid(this.cx, this.cz, half * 2, half * 2, top);
  }

  deactivate() { this.active = false; this.group.visible = false; this._clear(); }
}
