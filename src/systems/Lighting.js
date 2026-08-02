import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =============================================================================
// Lighting — iluminación de DÍA: sol direccional cálido con sombras dinámicas,
// luz de hemisferio (rebote cielo/suelo) y una ambiental tenue.
// El sol sigue al jugador para que las sombras funcionen en el mundo infinito.
//
// Diseñado para el futuro ciclo día/noche: expone setTimeOfDay(0..1) que
// interpola color/intensidad. DayNightCycle.js (stub) lo conducirá.
// =============================================================================

const E = CONFIG.environment;
const N = CONFIG.night;

export class Lighting {
  constructor(scene) {
    this.scene = scene;

    this.hemi = new THREE.HemisphereLight(E.hemiSky, E.hemiGround, E.hemiIntensity);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(E.sunColor, E.sunIntensity);
    this.sun.position.set(-60, 90, 40);
    this.sun.castShadow = CONFIG.render.shadows;
    const s = this.sun.shadow;
    s.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
    s.camera.near = 1;
    s.camera.far = 400;
    const d = 90;
    s.camera.left = -d; s.camera.right = d;
    s.camera.top = d; s.camera.bottom = -d;
    s.bias = -0.0004;
    s.normalBias = 0.02;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // ---- luz que sigue al personaje (se enciende de noche) ----
    // Mantiene al jugador bien visible en la oscuridad sin inundar la escena.
    this.playerLight = new THREE.PointLight(N.playerLightColor, 0, N.playerLightDistance, 2);
    this.playerLight.castShadow = false;
    scene.add(this.playerLight);

    // ---- paletas día / noche (para interpolar con nightFactor) ----
    this._dayNight = {
      sunColorDay: new THREE.Color(E.sunColor),
      sunColorNight: new THREE.Color(0x35406a),   // luz de luna azulada
      sunDay: E.sunIntensity,
      sunNight: 0.22,
      hemiSkyDay: new THREE.Color(E.hemiSky),
      hemiSkyNight: new THREE.Color(0x0b1226),
      hemiGroundDay: new THREE.Color(E.hemiGround),
      hemiGroundNight: new THREE.Color(0x05060a),
      hemiDay: E.hemiIntensity,
      hemiNight: 0.07,
      ambDay: 0.18,
      ambNight: 0.035
    };
    // caché para lerps sin alocar
    this._c = new THREE.Color();
  }

  // El sol y su cámara de sombra siguen al jugador (sombras siempre nítidas).
  update(player) {
    const p = player.pos;
    this.sun.position.set(p.x - 60, 90, p.z + 40);
    this.sun.target.position.set(p.x, 0, p.z - 20);
    this.sun.target.updateMatrixWorld();
    // la luz del personaje va a la altura del pecho, siguiéndolo
    this.playerLight.position.set(p.x, p.y + 1.6, p.z);
  }

  // Interpola toda la iluminación entre día (nf=0) y noche (nf=1).
  // De noche todo baja mucho: sólo iluminan faroles, ventanas y linternas.
  applyNight(nf) {
    const d = this._dayNight;
    this.sun.intensity = THREE.MathUtils.lerp(d.sunDay, d.sunNight, nf);
    this.sun.color.copy(d.sunColorDay).lerp(d.sunColorNight, nf);
    this.hemi.intensity = THREE.MathUtils.lerp(d.hemiDay, d.hemiNight, nf);
    this.hemi.color.copy(d.hemiSkyDay).lerp(d.hemiSkyNight, nf);
    this.hemi.groundColor.copy(d.hemiGroundDay).lerp(d.hemiGroundNight, nf);
    this.ambient.intensity = THREE.MathUtils.lerp(d.ambDay, d.ambNight, nf);
    // el personaje se ilumina cuanto más oscuro está (0 de día, máx de noche)
    this.playerLight.intensity = N.playerLightIntensity * nf;
  }

  // Compat: t=0 amanecer, 0.5 mediodía, 1 noche.
  setTimeOfDay(t) {
    const dayIntensity = Math.max(0, Math.sin(t * Math.PI));
    this.applyNight(1 - dayIntensity);
  }
}
