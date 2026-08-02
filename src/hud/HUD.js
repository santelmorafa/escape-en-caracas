import { CONFIG } from '../config.js';

// =============================================================================
// HUD — capa DOM sobre el canvas: distancia, sprint, proximidad policial (radar
// + barra), avisos, deslumbramiento nocturno, MENÚ DE INICIO (con récord),
// PANTALLA DE PAUSA y pantalla de muerte. Es agnóstico del juego: recibe datos
// vía update() y dispara callbacks (onPlay, onResume, onToMenu, onContinue…).
// =============================================================================

const MAX_KEY = 'escape_caracas_max_distance';
// Versión = timestamp del build/push (inyectado por Vite; ver vite.config.js).
const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';

export class HUD {
  constructor(root) {
    this.root = root;
    this.maxDistance = Number(localStorage.getItem(MAX_KEY) || 0);
    this.onContinue = null;   // muerte -> reaparecer
    this.onToMenu = null;     // -> volver al menú
    this.onPlay = null;       // menú -> jugar
    this.onResume = null;     // pausa -> reanudar
    this.onPauseRequest = null; // botón de pausa
    this.onToggleMute = null;
    this._build();
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-distance"><span id="hud-dist">0</span><small>m</small></div>
        <div class="hud-max">Récord: <span id="hud-max">0</span> m</div>
      </div>

      <div class="hud-sprint">
        <div class="hud-sprint-label">SPRINT</div>
        <div class="hud-sprint-bar"><div class="hud-sprint-fill" id="hud-sprint-fill"></div></div>
      </div>

      <div class="hud-police" id="hud-police">
        <div class="hud-police-label">🚔 POLICÍA</div>
        <div class="hud-radar" id="hud-radar"><div class="hud-radar-player"></div></div>
        <div class="hud-police-bar"><div class="hud-police-fill" id="hud-police-fill"></div></div>
      </div>

      <div class="hud-toast" id="hud-toast"></div>
      <div class="hud-dazzle" id="hud-dazzle"></div>

      <button class="hud-help-btn" id="hud-pause-btn" title="Pausa (Esc)">⏸</button>
      <button class="hud-mute-btn" id="hud-mute-btn" title="Silenciar (M)">🔊</button>

      <div class="hud-controls">
        <b>WASD</b> mover · <b>Mouse</b> mirar · ESPACIO saltar · F agacharse · SHIFT sprint · <b>P pausa</b>
      </div>

      <!-- MENÚ DE INICIO -->
      <div class="hud-menu show" id="hud-menu">
        <div class="hud-menu-panel">
          <h1 class="hud-title">ESCAPE EN<span>CARACAS</span></h1>
          <p class="hud-tag">Parkour infinito por la ciudad. Corre. No mires atrás.</p>
          <div class="hud-record">🏆 Récord: <span id="hud-menu-record">0</span> m</div>
          <button id="hud-play">▶ JUGAR</button>
          <button class="hud-secondary" id="hud-pick-start">📍 Elegir lugar de inicio</button>
          <button class="hud-secondary" id="hud-time-toggle">☀️ Empezar: Día</button>
          <div class="hud-start-label" id="hud-start-label">Inicio: centro de la ciudad</div>
          <div class="hud-menu-hint">
            <b>W/A/S/D</b> moverte · <b>Mouse</b> mirar (clic para capturar) · <b>ESPACIO</b> saltar<br>
            <b>F</b> agacharte · <b>SHIFT</b> sprint · <b>P</b> pausa · ¡súbete a los techos!
          </div>
          <div class="hud-version">versión ${APP_VERSION}</div>
        </div>
      </div>

      <!-- MAPA: elegir lugar de inicio -->
      <div class="hud-map" id="hud-map">
        <div class="hud-map-panel">
          <h2>ELIGE DÓNDE EMPEZAR</h2>
          <canvas id="hud-map-canvas" width="340" height="340"></canvas>
          <p class="hud-map-hint">Toca una manzana. 🟩 plaza · 🟨 hito · empiezas en la calle de esa manzana.</p>
          <button id="hud-map-done">Listo</button>
        </div>
      </div>

      <!-- PAUSA -->
      <div class="hud-pause" id="hud-pause">
        <div class="hud-pause-panel">
          <h2>PAUSA</h2>
          <table class="hud-keys">
            <tr><td><kbd>W</kbd> <kbd>S</kbd></td><td>Adelante / atrás</td></tr>
            <tr><td><kbd>A</kbd> <kbd>D</kbd></td><td>Moverte de lado</td></tr>
            <tr><td><kbd>Mouse</kbd></td><td>Mirar alrededor (clic para capturar)</td></tr>
            <tr><td><kbd>ESPACIO</kbd></td><td>Saltar / subir a azoteas</td></tr>
            <tr><td><kbd>F</kbd></td><td>Agacharte / deslizarte</td></tr>
            <tr><td><kbd>SHIFT</kbd></td><td>Sprint (aleja a la policía)</td></tr>
            <tr><td><kbd>P</kbd> / <kbd>Esc</kbd></td><td>Pausa · <kbd>M</kbd> silencio</td></tr>
          </table>
          <ul class="hud-tips">
            <li>Chocar = <b>tropiezo</b> (la policía se acerca). Un hueco te mata.</li>
            <li>Salta a las <b>azoteas</b> para escapar; si el salto queda corto te agarras del borde.</li>
          </ul>
          <button id="hud-resume">Reanudar</button>
          <button class="hud-secondary" id="hud-pause-menu">Menú principal</button>
        </div>
      </div>

      <!-- MUERTE -->
      <div class="hud-death" id="hud-death">
        <div class="hud-death-panel">
          <h2 id="hud-death-title">¡TE ATRAPARON!</h2>
          <p class="hud-death-dist">Llegaste a <span id="hud-death-dist">0</span> m</p>
          <p class="hud-death-max">Distancia máxima: <span id="hud-death-max">0</span> m</p>
          <button id="hud-continue">Reintentar</button>
          <button class="hud-secondary" id="hud-death-menu">Menú principal</button>
          <p class="hud-death-hint">(ENTER para reintentar)</p>
        </div>
      </div>
    `;

    const $ = (id) => this.root.querySelector(id);
    this.$dist = $('#hud-dist');
    this.$max = $('#hud-max');
    this.$sprintFill = $('#hud-sprint-fill');
    this.$police = $('#hud-police');
    this.$policeFill = $('#hud-police-fill');
    this.$radar = $('#hud-radar');
    this.$toast = $('#hud-toast');
    this.$dazzle = $('#hud-dazzle');
    this.$menu = $('#hud-menu');
    this.$menuRecord = $('#hud-menu-record');
    this.$pause = $('#hud-pause');
    this.$death = $('#hud-death');
    this.$deathTitle = $('#hud-death-title');
    this.$deathDist = $('#hud-death-dist');
    this.$deathMax = $('#hud-death-max');
    this.$muteBtn = $('#hud-mute-btn');
    this.$map = $('#hud-map');
    this.$mapCanvas = $('#hud-map-canvas');
    this.$startLabel = $('#hud-start-label');
    this._start = { gi: 0, gj: 0 };
    this._mapCenter = { gi: 0, gj: 0 };
    this._startTime = 'day';
    this.$timeToggle = $('#hud-time-toggle');
    this.getTileType = null;   // (gi,gj)=>type, lo pone el Game
    this.onPickStart = null;   // (x,z,gi,gj)=>void
    this.onSetStartTime = null; // ('day'|'night')=>void

    this.$max.textContent = Math.floor(this.maxDistance);
    this.$menuRecord.textContent = Math.floor(this.maxDistance);

    $('#hud-play').addEventListener('click', () => this.onPlay && this.onPlay());
    $('#hud-pick-start').addEventListener('click', () => this.showMap());
    this.$timeToggle.addEventListener('click', () => {
      this._startTime = this._startTime === 'day' ? 'night' : 'day';
      this.$timeToggle.textContent = this._startTime === 'day' ? '☀️ Empezar: Día' : '🌙 Empezar: Noche';
      if (this.onSetStartTime) this.onSetStartTime(this._startTime);
    });
    $('#hud-map-done').addEventListener('click', () => this.hideMap());
    this.$mapCanvas.addEventListener('click', (e) => this._onMapClick(e));
    $('#hud-resume').addEventListener('click', () => this.onResume && this.onResume());
    $('#hud-pause-menu').addEventListener('click', () => this.onToMenu && this.onToMenu());
    $('#hud-continue').addEventListener('click', () => this.onContinue && this.onContinue());
    $('#hud-death-menu').addEventListener('click', () => this.onToMenu && this.onToMenu());
    $('#hud-pause-btn').addEventListener('click', () => this.onPauseRequest && this.onPauseRequest());
    this.$muteBtn.addEventListener('click', () => this.onToggleMute && this.onToggleMute());

    this._radarDots = [];
    for (let i = 0; i < CONFIG.police.maxCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'hud-radar-cop';
      dot.style.display = 'none';
      this.$radar.appendChild(dot);
      this._radarDots.push(dot);
    }
    this.$police.style.display = 'none';
    this._toastTimer = 0;
  }

  update(player, dt, police, nightFactor = 0, cameraYaw = 0) {
    const d = Math.floor(player.distance);
    this.$dist.textContent = d;
    if (d > this.maxDistance) { this.maxDistance = d; this.$max.textContent = d; }

    const dazzle = police ? (police.dazzle || 0) : 0;
    const nightTint = Math.max(0, nightFactor - 0.35) * 0.28;
    this.$dazzle.style.opacity = Math.min(0.85, dazzle);
    this.$dazzle.style.background = dazzle > 0.02
      ? `radial-gradient(circle at 50% 60%, rgba(255,250,235,${0.55 * dazzle}) 0%, rgba(255,248,225,${0.25 * dazzle}) 40%, transparent 75%)`
      : `radial-gradient(circle at 50% 120%, transparent 55%, rgba(6,10,26,${nightTint}) 100%)`;
    if (dazzle <= 0.02) this.$dazzle.style.opacity = 1;

    let pct, cls;
    if (player.sprintCooldown > 0) {
      pct = (1 - player.sprintCooldown / CONFIG.sprint.cooldown) * 100; cls = 'cooldown';
    } else {
      pct = (player.sprintTimer / CONFIG.sprint.duration) * 100; cls = player.sprintActive ? 'active' : 'ready';
    }
    this.$sprintFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    this.$sprintFill.className = 'hud-sprint-fill ' + cls;

    if (police && police.enabled) { this.$police.style.display = 'block'; this._updatePolice(police, cameraYaw); }

    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.$toast.classList.remove('show');
    }
  }

  _updatePolice(police, cameraYaw) {
    const prox = Math.max(0, Math.min(1, police.proximity));
    this.$policeFill.style.width = (prox * 100) + '%';
    this.$policeFill.style.background = `hsl(${(1 - prox) * 90}, 85%, 50%)`;
    this.$police.classList.toggle('danger', prox > 0.7);

    // radar CENTRADO en el jugador; los policías se ubican por su posición
    // relativa a la cámara (adelante = arriba). El radio cubre proxRange metros.
    const range = CONFIG.police.proxRange;
    const units = police.radarUnits(cameraYaw);
    for (let i = 0; i < this._radarDots.length; i++) {
      const dot = this._radarDots[i], u = units[i];
      if (!u) { dot.style.display = 'none'; continue; }
      dot.style.display = 'block';
      const px = 50 + (u.dx / range) * 50;
      const py = 50 - (u.dz / range) * 50;   // adelante -> arriba
      dot.style.left = Math.max(3, Math.min(97, px)) + '%';
      dot.style.top = Math.max(3, Math.min(97, py)) + '%';
      const near = 1 - Math.min(1, Math.hypot(u.dx, u.dz) / range);
      dot.style.background = `hsl(${(1 - near) * 90}, 90%, 55%)`;
    }
  }

  toast(text, seconds = 2.2) {
    this.$toast.textContent = text;
    this.$toast.classList.add('show');
    this._toastTimer = seconds;
  }

  showMenu() {
    this.$menuRecord.textContent = Math.floor(this.maxDistance);
    this.$menu.classList.add('show');
  }

  // ---- mapa para elegir lugar de inicio ----
  showMap() { this.$map.classList.add('show'); this._drawMap(); }
  hideMap() { this.$map.classList.remove('show'); }

  _drawMap() {
    const cv = this.$mapCanvas, ctx = cv.getContext('2d');
    const R = 8, N = 2 * R + 1, cell = cv.width / N;
    const colors = {
      tower: '#6b8f6b', slab: '#6b7f9f', round: '#9f7f6b', twin: '#9f9f6b',
      lowblock: '#7a7a7a', plaza: '#2e7d5b', market: '#b07a4a', landmark: '#ffcf5a'
    };
    ctx.fillStyle = '#0b0f16'; ctx.fillRect(0, 0, cv.width, cv.height);
    const cgi = this._mapCenter.gi, cgj = this._mapCenter.gj;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const gi = cgi + (c - R), gj = cgj + (r - R);
      const type = this.getTileType ? this.getTileType(gi, gj) : 'tower';
      ctx.fillStyle = colors[type] || '#556';
      ctx.fillRect(c * cell + 1.5, r * cell + 1.5, cell - 3, cell - 3);  // hueco = calles
    }
    // marcador del inicio elegido
    const sc = this._start.gi - cgi + R, sr = this._start.gj - cgj + R;
    ctx.strokeStyle = '#18e0a0'; ctx.lineWidth = 3;
    ctx.strokeRect(sc * cell + 1, sr * cell + 1, cell - 2, cell - 2);
    ctx.fillStyle = '#18e0a0';
    ctx.beginPath(); ctx.arc(sc * cell + cell / 2, sr * cell + cell / 2, cell * 0.24, 0, Math.PI * 2); ctx.fill();
  }

  _onMapClick(e) {
    const cv = this.$mapCanvas, rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (cv.width / rect.width);
    const y = (e.clientY - rect.top) * (cv.height / rect.height);
    const R = 8, N = 2 * R + 1, cell = cv.width / N;
    const c = Math.floor(x / cell), r = Math.floor(y / cell);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const gi = this._mapCenter.gi + (c - R), gj = this._mapCenter.gj + (r - R);
    this._start = { gi, gj };
    const T = CONFIG.city.tileSize;
    if (this.onPickStart) this.onPickStart(gi * T, gj * T, gi, gj);
    this.$startLabel.textContent = (gi === 0 && gj === 0)
      ? 'Inicio: centro de la ciudad' : `Inicio elegido: manzana (${gi}, ${gj})`;
    this._drawMap();
  }
  hideMenu() { this.$menu.classList.remove('show'); }
  showPause() { this.$pause.classList.add('show'); }
  hidePause() { this.$pause.classList.remove('show'); }

  setMute(muted) { this.$muteBtn.textContent = muted ? '🔇' : '🔊'; }

  showDeath(distance, reason = 'police') {
    this._saveMax();
    const titles = { police: '¡TE ATRAPÓ LA POLICÍA!', fall: '¡CAÍSTE AL VACÍO!', obstacle: '¡CHOCASTE!' };
    this.$deathTitle.textContent = titles[reason] || '¡TE ATRAPARON!';
    this.$deathDist.textContent = Math.floor(distance);
    this.$deathMax.textContent = Math.floor(this.maxDistance);
    this.$death.classList.add('show');
  }
  hideDeath() { this.$death.classList.remove('show'); }

  _saveMax() { localStorage.setItem(MAX_KEY, String(Math.floor(this.maxDistance))); }
}
