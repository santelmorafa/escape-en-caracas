import { CONFIG } from '../config.js';

// =============================================================================
// HUD — capa DOM sobre el canvas: distancia, sprint, proximidad policial (radar
// + barra), avisos, deslumbramiento nocturno, MENÚ DE INICIO (con récord),
// PANTALLA DE PAUSA y pantalla de muerte. Es agnóstico del juego: recibe datos
// vía update() y dispara callbacks (onPlay, onResume, onToMenu, onContinue…).
// =============================================================================

const MAX_KEY = 'escape_caracas_max_distance';

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
        W avanzar · A/D lateral · ESPACIO saltar · S deslizar · SHIFT sprint · <b>P/Esc pausa</b>
      </div>

      <!-- MENÚ DE INICIO -->
      <div class="hud-menu show" id="hud-menu">
        <div class="hud-menu-panel">
          <h1 class="hud-title">ESCAPE EN<span>CARACAS</span></h1>
          <p class="hud-tag">Parkour infinito por la ciudad. Corre. No mires atrás.</p>
          <div class="hud-record">🏆 Récord: <span id="hud-menu-record">0</span> m</div>
          <button id="hud-play">▶ JUGAR</button>
          <div class="hud-menu-hint">
            <b>W</b> avanzar · <b>A/D</b> lados · <b>ESPACIO</b> saltar (¡súbete a los techos!)<br>
            <b>S</b> deslizarte · <b>SHIFT</b> sprint · <b>P/Esc</b> pausa
          </div>
        </div>
      </div>

      <!-- PAUSA -->
      <div class="hud-pause" id="hud-pause">
        <div class="hud-pause-panel">
          <h2>PAUSA</h2>
          <table class="hud-keys">
            <tr><td><kbd>W</kbd></td><td>Acelerar</td></tr>
            <tr><td><kbd>A</kbd> <kbd>D</kbd></td><td>Moverte de lado</td></tr>
            <tr><td><kbd>ESPACIO</kbd></td><td>Saltar / subir a azoteas</td></tr>
            <tr><td><kbd>S</kbd> / <kbd>Ctrl</kbd></td><td>Agacharte / deslizarte</td></tr>
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
          <button id="hud-continue">Continuar desde el checkpoint</button>
          <button class="hud-secondary" id="hud-death-menu">Menú principal</button>
          <p class="hud-death-hint">(ENTER para continuar)</p>
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

    this.$max.textContent = Math.floor(this.maxDistance);
    this.$menuRecord.textContent = Math.floor(this.maxDistance);

    $('#hud-play').addEventListener('click', () => this.onPlay && this.onPlay());
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

  update(player, dt, police, nightFactor = 0) {
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

    if (police && police.enabled) { this.$police.style.display = 'block'; this._updatePolice(police); }

    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.$toast.classList.remove('show');
    }
  }

  _updatePolice(police) {
    const prox = Math.max(0, Math.min(1, police.proximity));
    this.$policeFill.style.width = (prox * 100) + '%';
    this.$policeFill.style.background = `hsl(${(1 - prox) * 90}, 85%, 50%)`;
    this.$police.classList.toggle('danger', prox > 0.7);

    const W = CONFIG.world.roadWidth, maxGap = CONFIG.police.maxGap;
    const units = police.radarUnits();
    for (let i = 0; i < this._radarDots.length; i++) {
      const dot = this._radarDots[i], u = units[i];
      if (!u) { dot.style.display = 'none'; continue; }
      dot.style.display = 'block';
      dot.style.left = Math.max(0, Math.min(100, ((u.dx / W) + 0.5) * 100)) + '%';
      dot.style.top = Math.max(0, Math.min(96, 100 * (1 - Math.min(1, u.dz / maxGap)))) + '%';
      const near = 1 - Math.min(1, u.dz / maxGap);
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
