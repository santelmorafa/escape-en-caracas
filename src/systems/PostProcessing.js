import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { CONFIG } from '../config.js';

// =============================================================================
// PostProcessing — EffectComposer con bloom sutil y SSAO opcional.
// Si el usuario desactiva postprocesado (o el navegador no lo soporta),
// se puede renderizar directo (ver Game.render()).
// =============================================================================

export class PostProcessing {
  constructor(renderer, scene, camera, size) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    if (CONFIG.render.ssao) {
      const ssao = new SSAOPass(scene, camera, size.w, size.h);
      ssao.kernelRadius = 8;
      ssao.minDistance = 0.002;
      ssao.maxDistance = 0.1;
      this.composer.addPass(ssao);
      this.ssao = ssao;
    }

    if (CONFIG.render.bloom) {
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(size.w, size.h),
        CONFIG.render.bloomStrength,
        CONFIG.render.bloomRadius,
        CONFIG.render.bloomThreshold
      );
      this.composer.addPass(bloom);
      this.bloom = bloom;
    }

    // Motion blur leve (afterimage): damp 0 = sin estela; se sube en sprint.
    this.afterimage = new AfterimagePass();
    this.afterimage.uniforms['damp'].value = 0.0;
    this.composer.addPass(this.afterimage);

    this.composer.addPass(new OutputPass());
  }

  // amount 0..1 -> "estela" del motion blur (se llama desde Game según el sprint)
  setMotionBlur(amount) {
    if (this.afterimage) this.afterimage.uniforms['damp'].value = Math.max(0, Math.min(0.85, amount));
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    if (this.ssao) this.ssao.setSize(w, h);
  }

  render() {
    this.composer.render();
  }
}
