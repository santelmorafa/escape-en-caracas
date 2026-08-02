import { Game } from './core/Game.js';

// =============================================================================
// Punto de entrada. Crea el juego, muestra progreso de carga y arranca el loop.
// =============================================================================

const loadingScreen = document.getElementById('loading-screen');
const loadingFill = document.getElementById('loading-bar-fill');
const loadingStatus = document.getElementById('loading-status');

function setProgress(p, msg) {
  loadingFill.style.width = Math.round(p * 100) + '%';
  if (msg) loadingStatus.textContent = msg;
}

async function boot() {
  const game = new Game(document.getElementById('game-root'));
  try {
    await game.init(setProgress);
    // ocultar overlay de carga
    loadingScreen.classList.add('hidden');
    setTimeout(() => (loadingScreen.style.display = 'none'), 700);
    game.start();
    window.__game = game; // acceso para depuración
  } catch (err) {
    console.error(err);
    loadingStatus.textContent = 'Error al cargar: ' + (err?.message || err);
    loadingStatus.style.color = '#ff5a4d';
  }
}

boot();
