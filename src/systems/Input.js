// =============================================================================
// Input — teclado + MOUSE en un estado neutro. Movimiento libre relativo a la
// cámara: W adelante, S atrás, A/D lateral, F agacharse, SHIFT sprint, ESPACIO
// saltar. El mouse mira alrededor (pointer lock; o arrastrando con el botón).
// Los controles táctiles (MobileControls) escriben sobre este mismo estado.
// =============================================================================

export class Input {
  constructor() {
    this.state = {
      forward: false,   // W
      back: false,      // S (caminar hacia atrás)
      left: false,      // A
      right: false,     // D
      crouch: false,    // F (agacharse / deslizarse)
      sprint: false     // Shift
    };
    this._pressed = { jump: false, restart: false, pause: false, mute: false };

    // mouse look
    this.mouse = { dx: 0, dy: 0, locked: false };
    this._dragging = false;
    this.canvas = null;

    this._keydown = this._onKeyDown.bind(this);
    this._keyup = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._keydown);
    window.addEventListener('keyup', this._keyup);
  }

  // Conecta el canvas para el mouse look (pointer lock + arrastre de respaldo).
  setCanvas(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this._dragging = true; });
    window.addEventListener('mouseup', () => { this._dragging = false; });
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === canvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.mouse.locked || this._dragging) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
  }

  requestPointerLock() {
    if (this.canvas && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }
  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  consumeMouse() {
    const m = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return m;
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.state.forward = true; break;
      case 'KeyS': case 'ArrowDown': this.state.back = true; break;
      case 'KeyA': case 'ArrowLeft': this.state.left = true; break;
      case 'KeyD': case 'ArrowRight': this.state.right = true; break;
      case 'KeyF': case 'KeyC': this.state.crouch = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.sprint = true; break;
      case 'Space': this._pressed.jump = true; e.preventDefault(); break;
      case 'Enter': this._pressed.restart = true; break;
      case 'Escape': case 'KeyP': this._pressed.pause = true; break;
      case 'KeyM': this._pressed.mute = true; break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.state.forward = false; break;
      case 'KeyS': case 'ArrowDown': this.state.back = false; break;
      case 'KeyA': case 'ArrowLeft': this.state.left = false; break;
      case 'KeyD': case 'ArrowRight': this.state.right = false; break;
      case 'KeyF': case 'KeyC': this.state.crouch = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.sprint = false; break;
    }
  }

  consume(action) {
    if (this._pressed[action]) { this._pressed[action] = false; return true; }
    return false;
  }

  setVirtual(action, value) {
    if (action in this.state) this.state[action] = value;
    else if (action in this._pressed && value) this._pressed[action] = true;
  }

  dispose() {
    window.removeEventListener('keydown', this._keydown);
    window.removeEventListener('keyup', this._keyup);
  }
}
