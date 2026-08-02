import { CONFIG } from '../config.js';

// =============================================================================
// AudioSystem — todo el sonido se SINTETIZA con Web Audio (sin archivos):
//  - Ambiente urbano (ruido filtrado, rumor de ciudad).
//  - Música de tensión (arpegio menor + pulso grave) que se INTENSIFICA
//    (volumen + tempo) cuanto más cerca está la policía.
//  - Sirena lejana cuyo volumen sube con la proximidad policial.
//  - SFX: pasos, salto, aterrizaje, rodar, deslizar, checkpoint, captura.
//
// Debe iniciarse tras un gesto del usuario (el botón JUGAR del menú) por la
// política de autoplay. Si Web Audio no está disponible, todo es no-op.
// =============================================================================

const A = CONFIG.audio;

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this._noteTime = 0;
    this._step = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const now = this.ctx.currentTime;
      this.master = this.ctx.createGain(); this.master.gain.value = A.master; this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.ambBus = this.ctx.createGain(); this.ambBus.gain.value = 0; this.ambBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);
      this.sirenBus = this.ctx.createGain(); this.sirenBus.gain.value = 0; this.sirenBus.connect(this.master);
      this._buildAmbience();
      this._buildSiren();
      this._noteTime = now + 0.1;
      this._shouldPlay = true;
      this.ready = true;

      // Detener el audio al ocultar la pestaña y DESTRUIR el contexto al cerrarla
      // o al perder el foco (evita que el sonido siga sonando tras cerrar).
      this._onVis = () => {
        if (!this.ctx) return;
        if (document.hidden) { if (this.ctx.state === 'running') this.ctx.suspend(); }
        else if (this._shouldPlay) { this.ctx.resume(); this._noteTime = this.ctx.currentTime + 0.1; }
      };
      this._onHide = () => this.dispose();
      document.addEventListener('visibilitychange', this._onVis);
      // pagehide/beforeunload/unload cubren cierre de pestaña y navegación;
      // freeze cubre el ciclo de vida (bfcache/suspensión del navegador).
      for (const ev of ['pagehide', 'beforeunload', 'unload', 'freeze']) {
        window.addEventListener(ev, this._onHide, { capture: true });
      }
      // si la pestaña ya está oculta al iniciar, arrancar en silencio
      if (document.hidden) { try { this.ctx.suspend(); } catch (_) {} }
    } catch (e) {
      console.warn('[Audio] Web Audio no disponible:', e);
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _buildAmbience() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3); src.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
    src.connect(lp); lp.connect(this.ambBus);
    src.start();
    this.ambBus.gain.setTargetAtTime(A.ambience, this.ctx.currentTime, 3);
  }

  _buildSiren() {
    // sirena lejana: sierra con vibrato lento a través de un bandpass
    const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 720;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 820; bp.Q.value = 7;
    const lfo = this.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.35;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 150;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    osc.connect(bp); bp.connect(this.sirenBus);
    osc.start(); lfo.start();
  }

  // Llamado cada frame. info = { tension(0..1), proximity(0..1), night(0..1) }.
  update(dt, info) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const t = Math.max(0, Math.min(1, info.tension));
    this.musicBus.gain.setTargetAtTime(A.music * (0.12 + 0.88 * t), now, 0.3);
    const sirenVol = A.siren * Math.max(0, info.proximity - 0.12) * (0.55 + 0.45 * (info.night || 0));
    this.sirenBus.gain.setTargetAtTime(sirenVol, now, 0.4);
    this._scheduleMusic(t);
  }

  _scheduleMusic(t) {
    const ctx = this.ctx, look = 0.12;
    const beat = 0.55 - 0.33 * t;   // más rápido con la tensión
    while (this._noteTime < ctx.currentTime + look) {
      this._playBeat(this._noteTime, t);
      this._noteTime += beat;
    }
  }

  _playBeat(time, t) {
    // pulso grave (siempre) + nota de arpegio menor (sube con la tensión)
    this._tone(time, 55, 0.22, 'triangle', 0.45, this.musicBus);
    const scale = [0, 3, 5, 7, 10, 12, 10, 7];
    const n = scale[this._step % scale.length]; this._step++;
    this._tone(time, 220 * Math.pow(2, n / 12), 0.14, 'sawtooth', 0.06 + 0.28 * t, this.musicBus);
  }

  _tone(time, freq, dur, type, gain, dest) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(dest || this.sfxBus);
    o.start(time); o.stop(time + dur + 0.03);
  }

  _sweep(f0, f1, dur, type, gain) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, gain), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(now); o.stop(now + dur + 0.03);
  }

  _noiseBurst(dur, hp, gain) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuffer(Math.max(0.05, dur));
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(now); src.stop(now + dur + 0.02);
  }

  // ---- SFX públicos ----
  step() { this._noiseBurst(0.09, 900 + Math.random() * 300, 0.22); }
  jump() { this._sweep(300, 620, 0.18, 'sine', 0.28); }
  land() { this._sweep(180, 65, 0.16, 'sine', 0.34); this._noiseBurst(0.12, 500, 0.18); }
  roll() { this._noiseBurst(0.35, 300, 0.28); this._sweep(220, 120, 0.3, 'sine', 0.16); }
  slide() { this._noiseBurst(0.4, 700, 0.2); }
  checkpoint() {
    if (!this.ready) return;
    const n = this.ctx.currentTime;
    this._tone(n, 880, 0.12, 'sine', 0.22, this.sfxBus);
    this._tone(n + 0.1, 1320, 0.16, 'sine', 0.18, this.sfxBus);
  }
  capture() { this._sweep(200, 45, 0.5, 'sawtooth', 0.4); this._noiseBurst(0.3, 200, 0.25); }

  // ---- control ----
  toggleMute() {
    this.muted = !this.muted;
    if (this.ready) this.master.gain.setTargetAtTime(this.muted ? 0 : A.master, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  // Pausa/reanuda TODO el audio suspendiendo el AudioContext (se corta de
  // verdad: ambiente, sirena, música). Al reanudar, evita ráfaga de notas.
  setActive(on) {
    if (!this.ready) return;
    this._shouldPlay = on;
    if (on) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._noteTime = this.ctx.currentTime + 0.1;
    } else {
      if (this.ctx.state === 'running') this.ctx.suspend();
    }
  }

  // Destruye el contexto (al cerrar la pestaña) para que no quede sonido colgado.
  dispose() {
    this._shouldPlay = false;
    try { document.removeEventListener('visibilitychange', this._onVis); } catch (_) {}
    for (const ev of ['pagehide', 'beforeunload', 'unload', 'freeze']) {
      try { window.removeEventListener(ev, this._onHide, { capture: true }); } catch (_) {}
    }
    if (this.ctx) {
      try { if (this.master) this.master.gain.value = 0; } catch (_) {}
      try { this.ctx.close(); } catch (_) {}
      this.ctx = null; this.ready = false;
    }
  }
}
