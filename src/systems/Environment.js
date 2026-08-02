import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// Environment — cielo, niebla atmosférica y EL ÁVILA (Waraira Repano), con
// transición DÍA/NOCHE. El cielo es un domo con gradiente por vértices cuyo
// color se multiplica (día = claro, noche = azul muy oscuro con bruma). La
// niebla se cierra de noche (visibilidad reducida) y El Ávila queda como
// silueta. applyNight(nf) hace toda la interpolación (nf: 0 día, 1 noche).
// =============================================================================

const E = CONFIG.environment;

// Domo de cielo con gradiente vertical por vértices (unlit, sin niebla).
function buildSkyDome() {
  const R = 900;
  const geo = new THREE.SphereGeometry(R, 24, 16);
  const pos = geo.attributes.position;
  const colors = [];
  const top = new THREE.Color(E.skyTopColor);
  const mid = new THREE.Color(E.skyBottomColor);
  const horizon = new THREE.Color(0xeef3f6);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / R; // -1..1
    if (y >= 0) c.copy(mid).lerp(top, y);
    else c.copy(mid).lerp(horizon, Math.min(1, -y * 2));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
  });
  return new THREE.Mesh(geo, mat);
}

function buildAvila() {
  const length = 2200, segs = 220;
  const positions = [], colors = [];
  const low = new THREE.Color(0x3f6b34), high = new THREE.Color(0x7d9b78);
  const ridge = (z) => {
    const t = z * 0.006;
    return 120 + Math.sin(t) * 35 + Math.sin(t * 2.3 + 1.7) * 22
      + Math.sin(t * 5.1 + 0.5) * 12 + Math.sin(t * 0.7) * 40;
  };
  for (let i = 0; i < segs; i++) {
    const z0 = -length / 2 + (i / segs) * length;
    const z1 = -length / 2 + ((i + 1) / segs) * length;
    const h0 = ridge(z0), h1 = ridge(z1);
    const b0 = [0, 0, z0], t0 = [0, h0, z0], b1 = [0, 0, z1], t1 = [0, h1, z1];
    positions.push(...b0, ...t0, ...t1, ...b0, ...t1, ...b1);
    const cb = low, ct0 = low.clone().lerp(high, h0 / 200), ct1 = low.clone().lerp(high, h1 / 200);
    colors.push(cb.r, cb.g, cb.b, ct0.r, ct0.g, ct0.b, ct1.r, ct1.g, ct1.b,
      cb.r, cb.g, cb.b, ct1.r, ct1.g, ct1.b, cb.r, cb.g, cb.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0.0, fog: true });
  return new THREE.Mesh(geo, mat);
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(E.skyBottomColor);

    this.sky = buildSkyDome();
    scene.add(this.sky);

    this.fog = new THREE.Fog(CONFIG.render.fog.color, CONFIG.render.fog.near, CONFIG.render.fog.far);
    scene.fog = this.fog;

    // El Ávila (dos cordilleras para dar profundidad/bruma)
    this.avila = buildAvila();
    const side = E.avilaSide === 'left' ? -1 : 1;
    this.avilaX = side * E.avilaDistance;
    this.avila.position.x = this.avilaX;
    this.avila.rotation.y = side < 0 ? 0 : Math.PI;
    scene.add(this.avila);

    this.avilaFar = buildAvila();
    this.avilaFar.position.x = side * (E.avilaDistance + 220);
    this.avilaFar.scale.y = 1.4;
    this.avilaFar.material = this.avila.material.clone();
    this.avilaFar.material.color = new THREE.Color(0x9fb6c4);
    scene.add(this.avilaFar);

    // paletas para interpolación
    this._pal = {
      skyDay: new THREE.Color(0xffffff),
      skyNight: new THREE.Color(0x0a1330),   // azul muy oscuro
      bgDay: new THREE.Color(E.skyBottomColor),
      bgNight: new THREE.Color(0x070b1c),
      fogDay: new THREE.Color(CONFIG.render.fog.color),
      fogNight: new THREE.Color(0x0a1024),   // bruma azul oscura
      avilaDay: new THREE.Color(0xffffff),
      avilaNight: new THREE.Color(0x0c1424),  // silueta apenas visible
      avilaFarDay: new THREE.Color(0x9fb6c4),
      avilaFarNight: new THREE.Color(0x0b1220),
      fogNearDay: CONFIG.render.fog.near, fogNearNight: 22,
      fogFarDay: CONFIG.render.fog.far, fogFarNight: 155
    };
  }

  // El domo y la montaña siguen al jugador (fondo permanente).
  update(playerZ, playerX = 0) {
    this.avila.position.z = playerZ;
    this.avilaFar.position.z = playerZ;
    this.sky.position.set(playerX, 0, playerZ);
  }

  applyNight(nf) {
    const p = this._pal;
    this.sky.material.color.copy(p.skyDay).lerp(p.skyNight, nf);
    this.scene.background.copy(p.bgDay).lerp(p.bgNight, nf);
    this.fog.color.copy(p.fogDay).lerp(p.fogNight, nf);
    this.fog.near = THREE.MathUtils.lerp(p.fogNearDay, p.fogNearNight, nf);
    this.fog.far = THREE.MathUtils.lerp(p.fogFarDay, p.fogFarNight, nf);
    this.avila.material.color.copy(p.avilaDay).lerp(p.avilaNight, nf);
    this.avilaFar.material.color.copy(p.avilaFarDay).lerp(p.avilaFarNight, nf);
  }
}
