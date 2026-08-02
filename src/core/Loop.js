// =============================================================================
// Loop — bucle de render con requestAnimationFrame y delta-time acotado.
// Acotar dt evita "saltos" físicos tras un frame largo (pestaña en 2º plano).
// =============================================================================

export class Loop {
  constructor(callback) {
    this.callback = callback;
    this.running = false;
    this.lastTime = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() { this.running = false; }

  _tick(now) {
    if (!this.running) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05); // clamp ~20fps mínimo lógico
    this.callback(dt);
    requestAnimationFrame(this._tick);
  }
}
