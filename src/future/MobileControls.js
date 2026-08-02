import { CONFIG } from '../config.js';

// =============================================================================
// MobileControls — panel de botones táctiles en pantalla. Escribe sobre el MISMO
// objeto Input del juego (input.setVirtual), así que ni el jugador ni el resto
// del código saben si la orden vino de teclado o del dedo.
//
// Distribución pensada para dos pulgares:
//   - Pulgar IZQUIERDO (abajo-izquierda): ◀ / ▶  (movimiento lateral, mantener)
//   - Pulgar DERECHO  (abajo-derecha):  SALTAR (tap), AGACHAR (mantener),
//                                        SPRINT (mantener, con cooldown encima)
// Botones grandes, semitransparentes y bien separados. Multitáctil real (cada
// botón captura su propio puntero, se pueden pulsar dos a la vez).
// =============================================================================

export class MobileControls {
  constructor(input, container) {
    this.input = input;
    this.container = container;   // #hud
    this.enabled = false;
    this.root = null;
    this._listeners = [];
  }

  static isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  mount() {
    if (this.root) return;
    document.body.classList.add('touch-controls'); // oculta la pista de teclado

    const root = document.createElement('div');
    root.className = 'mc-root';
    root.innerHTML = `
      <div class="mc-cluster mc-left">
        <div class="mc-dpad">
          <button class="mc-btn mc-dir mc-up" data-hold="forward" aria-label="Adelante">▲</button>
          <button class="mc-btn mc-dir mc-dl" data-hold="left" aria-label="Izquierda">◀</button>
          <button class="mc-btn mc-dir mc-dr" data-hold="right" aria-label="Derecha">▶</button>
          <button class="mc-btn mc-dir mc-down" data-hold="back" aria-label="Atrás">▼</button>
        </div>
      </div>
      <div class="mc-cluster mc-right">
        <button class="mc-btn mc-crouch" data-hold="crouch" aria-label="Agacharse">
          <span class="mc-ico">⤓</span><span class="mc-lbl">AGACHAR</span>
        </button>
        <button class="mc-btn mc-sprint" data-hold="sprint" aria-label="Sprint">
          <span class="mc-ring" id="mc-sprint-ring"></span>
          <span class="mc-lbl">SPRINT</span>
        </button>
        <button class="mc-btn mc-jump" data-tap="jump" aria-label="Saltar">
          <span class="mc-ico">⤒</span><span class="mc-lbl">SALTAR</span>
        </button>
      </div>
    `;
    this.container.appendChild(root);
    this.root = root;
    this.$ring = root.querySelector('#mc-sprint-ring');
    this.$sprint = root.querySelector('.mc-sprint');

    // botones de MANTENER (estado continuo)
    root.querySelectorAll('[data-hold]').forEach((btn) => {
      this._bindHold(btn, btn.getAttribute('data-hold'));
    });
    // botones de TAP (acción de flanco)
    root.querySelectorAll('[data-tap]').forEach((btn) => {
      this._bindTap(btn, btn.getAttribute('data-tap'));
    });

    this.enabled = true;
  }

  _add(el, type, fn) {
    el.addEventListener(type, fn, { passive: false });
    this._listeners.push([el, type, fn]);
  }

  _bindHold(btn, action) {
    const down = (e) => {
      e.preventDefault();
      this.input.setVirtual(action, true);
      btn.classList.add('active');
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const up = (e) => {
      e.preventDefault();
      this.input.setVirtual(action, false);
      btn.classList.remove('active');
    };
    this._add(btn, 'pointerdown', down);
    this._add(btn, 'pointerup', up);
    this._add(btn, 'pointercancel', up);
    this._add(btn, 'lostpointercapture', up);
  }

  _bindTap(btn, action) {
    const down = (e) => {
      e.preventDefault();
      this.input.setVirtual(action, true); // acción de flanco (jump)
      btn.classList.add('active');
    };
    const up = (e) => { e.preventDefault(); btn.classList.remove('active'); };
    this._add(btn, 'pointerdown', down);
    this._add(btn, 'pointerup', up);
    this._add(btn, 'pointercancel', up);
  }

  // Actualiza el aro de cooldown del sprint (llamado cada frame por el Game).
  update(player) {
    if (!this.$ring || !player) return;
    const C = CONFIG.sprint;
    let pct, col, disabled = false;
    if (player.sprintCooldown > 0) {
      pct = (1 - player.sprintCooldown / C.cooldown) * 100;
      col = 'rgba(255,90,77,0.95)';   // recargando (rojo)
      disabled = true;
    } else if (player.sprintActive) {
      pct = (player.sprintTimer / C.duration) * 100;
      col = 'rgba(255,179,64,0.95)';  // en uso (ámbar)
    } else {
      pct = (player.sprintTimer / C.duration) * 100;
      col = 'rgba(24,224,160,0.95)';  // listo (verde)
    }
    this.$ring.style.background =
      `conic-gradient(${col} ${pct * 3.6}deg, rgba(255,255,255,0.14) 0)`;
    this.$sprint.classList.toggle('mc-disabled', disabled);
  }

  unmount() {
    for (const [el, type, fn] of this._listeners) el.removeEventListener(type, fn);
    this._listeners.length = 0;
    if (this.root) this.root.remove();
    this.root = null;
    this.enabled = false;
    document.body.classList.remove('touch-controls');
  }
}
