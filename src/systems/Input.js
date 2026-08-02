// =============================================================================
// Sistema de entrada. Abstrae el teclado en un objeto de ESTADO/ACCIONES neutro
// para que el jugador no sepa de qué dispositivo viene la orden. Los controles
// táctiles (src/future/MobileControls.js) escribirán sobre este mismo estado.
// =============================================================================

export class Input {
  constructor() {
    // Estado continuo (mantener pulsado)
    this.state = {
      forward: false,   // W
      left: false,      // A
      right: false,     // D
      crouch: false,    // S / Ctrl
      sprint: false     // Shift
    };
    // Acciones de flanco (se consumen una vez)
    this._pressed = { jump: false, restart: false, pause: false, mute: false };

    this._keydown = this._onKeyDown.bind(this);
    this._keyup = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._keydown);
    window.addEventListener('keyup', this._keyup);
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.state.forward = true; break;
      case 'KeyA': case 'ArrowLeft': this.state.left = true; break;
      case 'KeyD': case 'ArrowRight': this.state.right = true; break;
      case 'KeyS': case 'ArrowDown': case 'ControlLeft': case 'ControlRight':
        this.state.crouch = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.sprint = true; break;
      case 'Space': this._pressed.jump = true; e.preventDefault(); break;
      case 'Enter': this._pressed.restart = true; break;
      case 'Escape': case 'KeyP': case 'KeyH': case 'F1':
        this._pressed.pause = true; e.preventDefault(); break;
      case 'KeyM': this._pressed.mute = true; break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.state.forward = false; break;
      case 'KeyA': case 'ArrowLeft': this.state.left = false; break;
      case 'KeyD': case 'ArrowRight': this.state.right = false; break;
      case 'KeyS': case 'ArrowDown': case 'ControlLeft': case 'ControlRight':
        this.state.crouch = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.sprint = false; break;
    }
  }

  // Consumir una acción de flanco (true una sola vez por pulsación).
  consume(action) {
    if (this._pressed[action]) {
      this._pressed[action] = false;
      return true;
    }
    return false;
  }

  // Usado por MobileControls (futuro) para inyectar entrada virtual.
  setVirtual(action, value) {
    if (action in this.state) this.state[action] = value;
    else if (action in this._pressed && value) this._pressed[action] = true;
  }

  dispose() {
    window.removeEventListener('keydown', this._keydown);
    window.removeEventListener('keyup', this._keyup);
  }
}
