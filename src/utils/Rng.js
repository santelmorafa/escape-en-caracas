// Generador pseudoaleatorio determinista (mulberry32).
// Un mismo seed -> mismo mundo. Cada chunk deriva su propio stream a partir
// del índice, para que reciclar chunks no altere lo ya visto.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stream reproducible para un chunk concreto.
export function rngForChunk(baseSeed, chunkIndex) {
  return mulberry32((baseSeed ^ (chunkIndex * 0x9e3779b1)) >>> 0);
}

export const rand = {
  range(rng, min, max) {
    return min + rng() * (max - min);
  },
  int(rng, min, max) {
    return Math.floor(min + rng() * (max - min + 1));
  },
  pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  },
  chance(rng, p) {
    return rng() < p;
  }
};
