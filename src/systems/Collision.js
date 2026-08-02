// =============================================================================
// CollisionSystem — colisión SÓLIDA horizontal. Los edificios (muros del
// corredor), obstáculos y azoteas son duros: el jugador no los atraviesa,
// resbala a lo largo de ellos. Se resuelve por ejes (X y luego Z) usando AABB
// expandidas por el radio del jugador, considerando el solape VERTICAL (así
// puedes pararte encima de una caja, o pasar agachado bajo una barra alta).
// =============================================================================

const EPS = 0.02;

export class CollisionSystem {
  constructor(world) {
    this.world = world;
  }

  // Devuelve {x,z} corregidos para que (nx,nz) no penetre ningún sólido.
  resolveHorizontal(pos, nx, nz, height, radius) {
    const feet = pos.y, head = pos.y + height;
    const solids = this.world.getNearbyColliders(pos.x, pos.z);

    const vOverlap = (b) => b.min.y < head - EPS && b.max.y > feet + EPS;

    // ---- eje X ----
    let rx = nx;
    for (const s of solids) {
      const b = s.box;
      if (!vOverlap(b)) continue;
      const minX = b.min.x - radius, maxX = b.max.x + radius;
      const minZ = b.min.z - radius, maxZ = b.max.z + radius;
      if (rx > minX && rx < maxX && pos.z > minZ && pos.z < maxZ) {
        if (pos.x <= b.min.x) rx = minX;
        else if (pos.x >= b.max.x) rx = maxX;
        else rx = (Math.abs(rx - minX) < Math.abs(rx - maxX)) ? minX : maxX;
      }
    }

    // ---- eje Z (con la X ya resuelta) ----
    let rz = nz;
    for (const s of solids) {
      const b = s.box;
      if (!vOverlap(b)) continue;
      const minX = b.min.x - radius, maxX = b.max.x + radius;
      const minZ = b.min.z - radius, maxZ = b.max.z + radius;
      if (rx > minX && rx < maxX && rz > minZ && rz < maxZ) {
        if (pos.z <= b.min.z) rz = minZ;
        else if (pos.z >= b.max.z) rz = maxZ;
        else rz = (Math.abs(rz - minZ) < Math.abs(rz - maxZ)) ? minZ : maxZ;
      }
    }

    return { x: rx, z: rz };
  }
}
