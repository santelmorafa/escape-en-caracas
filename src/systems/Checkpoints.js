import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// CheckpointSystem — marcadores cada N metros. Un arco luminoso claro atraviesa
// el corredor; al cruzarlo se guarda el punto de reaparición y se avisa al HUD.
// =============================================================================

export class CheckpointSystem {
  constructor(scene) {
    this.scene = scene;
    this.interval = CONFIG.checkpoints.interval;
    this.lastReached = { z: 0, y: 0, distance: 0 };
    this.nextDistance = this.interval;
    this.markers = [];      // pool de arcos visibles
    this.onReached = null;  // callback (distance) => void

    this._buildMarkerPool(4);
  }

  _buildMarkerPool(n) {
    const postGeo = new THREE.BoxGeometry(0.5, 6, 0.5);
    const barGeo = new THREE.BoxGeometry(CONFIG.world.roadWidth + 1, 0.6, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x18e0a0, emissive: 0x18e0a0, emissiveIntensity: 1.4,
      roughness: 0.4, metalness: 0.2
    });
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, mat);
        post.position.set(sx * (CONFIG.world.roadWidth / 2 + 0.5), 3, 0);
        g.add(post);
      }
      const bar = new THREE.Mesh(barGeo, mat);
      bar.position.set(0, 6, 0);
      g.add(bar);
      g.visible = false;
      this.scene.add(g);
      this.markers.push({ group: g, distance: -1 });
    }
    this._placeUpcomingMarkers();
  }

  _placeUpcomingMarkers() {
    // reparte los marcadores del pool en las próximas distancias-múltiplo
    for (let i = 0; i < this.markers.length; i++) {
      const dist = this.nextDistance + i * this.interval;
      const m = this.markers[i];
      m.distance = dist;
      m.group.position.set(0, 0, -dist);
      m.group.visible = true;
    }
  }

  update(player) {
    // ¿alcanzó el siguiente checkpoint?
    if (player.distance >= this.nextDistance) {
      const z = -this.nextDistance;
      this.lastReached = { z, y: 0, distance: this.nextDistance };
      const reached = this.nextDistance;
      this.nextDistance += this.interval;
      this._recycleMarkers();
      if (this.onReached) this.onReached(reached);
    }
  }

  _recycleMarkers() {
    // el marcador ya cruzado se reubica al frente
    let far = this.markers[0];
    for (const m of this.markers) if (m.distance > far.distance) far = m;
    const newDist = far.distance + this.interval;
    // reasignar el más cercano ya pasado
    let passed = null;
    for (const m of this.markers) {
      if (m.distance < this.nextDistance - this.interval + 1) { passed = m; break; }
    }
    if (passed) {
      passed.distance = newDist;
      passed.group.position.set(0, 0, -newDist);
    }
  }

  reset() {
    this.lastReached = { z: 0, y: 0, distance: 0 };
    this.nextDistance = this.interval;
    this._placeUpcomingMarkers();
  }

  get respawnPoint() {
    // reaparecer un poco antes del arco para no morir de nuevo al instante
    return { z: this.lastReached.z + 6, y: 0, distance: this.lastReached.distance };
  }
}
