import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// =============================================================================
// Carga de GLB con reporte de progreso agregado. Devuelve promesas; intenta
// una URL local y cae a un fallback si falla (útil para el personaje).
// =============================================================================

export class AssetLoader {
  constructor(onProgress) {
    this.gltf = new GLTFLoader();
    this.onProgress = onProgress || (() => {});
  }

  loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.gltf.load(
        url,
        (g) => resolve(g),
        (xhr) => {
          if (xhr.total) this.onProgress(url, xhr.loaded / xhr.total);
        },
        (err) => reject(err)
      );
    });
  }

  // Intenta `primary`; si falla, intenta `fallback`. Devuelve {gltf, usedFallback}.
  async loadGLTFWithFallback(primary, fallback) {
    try {
      const gltf = await this.loadGLTF(primary);
      return { gltf, usedFallback: false, url: primary };
    } catch (e) {
      if (!fallback) throw e;
      console.warn(`[AssetLoader] "${primary}" no disponible, usando fallback: ${fallback}`);
      const gltf = await this.loadGLTF(fallback);
      return { gltf, usedFallback: true, url: fallback };
    }
  }
}
