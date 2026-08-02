import * as THREE from 'three';

// =============================================================================
// Texturas PBR procedurales de alta calidad generadas en <canvas>.
// Es el camino "siempre funciona": nada de colores planos, con normal maps
// derivados. Si el usuario coloca texturas reales (PolyHaven/ambientCG) en
// public/textures, Materials.js las prefiere y estas quedan como respaldo.
// Todas se cachean por clave para no regenerar.
// =============================================================================

const _cache = new Map();

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Derivar un normal map sencillo a partir de un mapa de altura (luminancia).
function heightToNormal(srcCanvas, strength = 2.0) {
  const size = srcCanvas.width;
  const sctx = srcCanvas.getContext('2d');
  const src = sctx.getImageData(0, 0, size, size).data;
  const out = makeCanvas(size);
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  const at = (x, y) => {
    x = (x + size) % size;
    y = (y + size) % size;
    return src[(y * size + x) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const nz = 1.0;
      const len = Math.hypot(dx, dy, nz) || 1;
      const i = (y * size + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function texFromCanvas(canvas, { srgb = true, repeat = 1, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function noise2(ctx, size, cells, alpha, color) {
  // manchas suaves tipo ruido de valor
  const step = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const v = Math.random();
      ctx.globalAlpha = alpha * v;
      ctx.fillStyle = color;
      ctx.fillRect(x * step, y * step, step, step);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- Asfalto: gris oscuro, grietas, manchas de aceite ----------------------
function asphalt(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#33363b';
  ctx.fillRect(0, 0, size, size);
  // grano
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 46;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  noise2(ctx, size, 32, 0.08, '#000000');
  noise2(ctx, size, 16, 0.05, '#5a5f66');
  // manchas de aceite
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 20 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(10,10,12,0.5)');
    g.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // grietas
  ctx.strokeStyle = 'rgba(15,15,17,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    let x = Math.random() * size, y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

// ---- Acera: baldosas con junta -------------------------------------------
function sidewalk(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a8781';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tiles = 4, step = size / tiles;
  ctx.strokeStyle = 'rgba(40,40,40,0.6)';
  ctx.lineWidth = 4;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
  noise2(ctx, size, 24, 0.06, '#5f5c56');
  return c;
}

// ---- Fachada de concreto con ventanas -------------------------------------
// Devuelve { albedo, emissive }. El emissive marca en cálido un subconjunto de
// ventanas "encendidas" (resto negro) para el modo noche: cuesta 0 de perf
// (sólo un emissiveMap; no son luces reales).
function facade(size = 512, opts = {}) {
  const { base = '#b9b2a6', cols = 6, rows = 8, glass = '#38506a' } = opts;
  const c = makeCanvas(size), ctx = c.getContext('2d');
  const e = makeCanvas(size), ectx = e.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  ectx.fillStyle = '#000000'; ectx.fillRect(0, 0, size, size); // emissive base = negro
  noise2(ctx, size, 40, 0.05, '#6f6a60');
  noise2(ctx, size, 20, 0.04, '#d8d2c6');

  const mx = size * 0.06, my = size * 0.06;
  const cw = (size - mx * (cols + 1)) / cols;
  const ch = (size - my * (rows + 1)) / rows;
  // patrón determinista de ventanas encendidas (~45%)
  let seed = (cols * 131 + rows * 17 + base.length * 7) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = mx + col * (cw + mx);
      const y = my + r * (ch + my);
      ctx.fillStyle = '#3a3a3c';
      ctx.fillRect(x - 2, y - 2, cw + 4, ch + 4);
      const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
      g.addColorStop(0, glass); g.addColorStop(0.5, '#5a7690'); g.addColorStop(1, '#2b3d52');
      ctx.fillStyle = g; ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + ch * 0.7); ctx.lineTo(x + cw * 0.6, y); ctx.stroke();

      // ventana encendida en el mapa emissive
      if (rnd() < 0.45) {
        const warm = rnd() < 0.5 ? '#ffcf7a' : '#ffb347';
        const eg = ectx.createLinearGradient(x, y, x, y + ch);
        eg.addColorStop(0, warm); eg.addColorStop(1, '#c8842f');
        ectx.fillStyle = eg; ectx.fillRect(x, y, cw, ch);
      }
    }
  }
  return { albedo: c, emissive: e };
}

// ---- Metal (carrocería / faroles) -----------------------------------------
function metal(size = 256, tint = '#8892a0') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, tint); g.addColorStop(1, '#3a3f47');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  noise2(ctx, size, 64, 0.03, '#000000');
  return c;
}

// API pública: devuelve {map, normalMap, roughness?} cacheados ----------------
export const ProceduralTextures = {
  get(key, factory, normalStrength) {
    if (_cache.has(key)) return _cache.get(key);
    const val = factory();
    _cache.set(key, val);
    return val;
  },

  asphalt(repeat = 6) {
    return this.get('asphalt' + repeat, () => {
      const base = asphalt();
      return {
        map: texFromCanvas(base, { repeat }),
        normalMap: texFromCanvas(heightToNormal(base, 1.4), { srgb: false, repeat })
      };
    });
  },

  sidewalk(repeat = 3) {
    return this.get('sidewalk' + repeat, () => {
      const base = sidewalk();
      return {
        map: texFromCanvas(base, { repeat }),
        normalMap: texFromCanvas(heightToNormal(base, 2.2), { srgb: false, repeat })
      };
    });
  },

  facade(opts = {}) {
    const key = 'facade' + JSON.stringify(opts);
    return this.get(key, () => {
      const { albedo, emissive } = facade(512, opts);
      return {
        map: texFromCanvas(albedo, { repeat: 1 }),
        normalMap: texFromCanvas(heightToNormal(albedo, 1.0), { srgb: false, repeat: 1 }),
        emissiveMap: texFromCanvas(emissive, { repeat: 1 })
      };
    });
  },

  metal(tint) {
    const key = 'metal' + tint;
    return this.get(key, () => ({ map: texFromCanvas(metal(256, tint), { repeat: 1 }) }));
  }
};
