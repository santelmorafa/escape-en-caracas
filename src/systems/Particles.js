import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// Particles — sistema de polvo (THREE.Points con ShaderMaterial) barato y
// reciclado. Se emiten ráfagas al RODAR, DESLIZARSE y ATERRIZAR. Un único
// draw call para todas las partículas; se recorre un pool circular.
// =============================================================================

const P = CONFIG.particles;

export class Particles {
  constructor(scene) {
    const N = P.max;
    this.N = N;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.maxLife = new Float32Array(N);
    this.aLife = new Float32Array(N);
    this.aSize = new Float32Array(N);
    for (let i = 0; i < N; i++) this.pos[i * 3 + 1] = -9999;

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(this.aLife, 1));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(P.color) } },
      vertexShader: `
        attribute float aLife; attribute float aSize; varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (0.35 + aLife) * (40.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vLife; uniform vec3 uColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5; float r = length(d);
          if (r > 0.5) discard;
          float a = (1.0 - r * 2.0) * vLife * 0.75;
          gl_FragColor = vec4(uColor, a);
        }`
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }

  emit(x, y, z, count, opts = {}) {
    const spread = opts.spread ?? 1.6, up = opts.up ?? 2.2;
    const life = opts.life ?? 0.55, size = opts.size ?? 9, back = opts.back ?? 0;
    for (let k = 0; k < count; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.N;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.5;
      this.pos[i * 3 + 1] = y + 0.1 + Math.random() * 0.2;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
      this.vel[i * 3] = (Math.random() - 0.5) * spread;
      this.vel[i * 3 + 1] = Math.random() * up;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * spread + back;
      this.maxLife[i] = life * (0.7 + Math.random() * 0.6);
      this.life[i] = this.maxLife[i];
      this.aSize[i] = size * (0.7 + Math.random() * 0.8);
    }
  }

  update(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.aLife[i] = 0; continue; }
      this.life[i] -= dt;
      this.aLife[i] = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= 3.5 * dt;              // gravedad leve
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.03) { this.pos[i * 3 + 1] = 0.03; this.vel[i * 3 + 1] *= -0.2; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}
