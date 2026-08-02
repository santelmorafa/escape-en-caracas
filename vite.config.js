import { defineConfig } from 'vite';

// Vite es suficiente para servir ES modules y assets estáticos (GLB/texturas)
// desde /public. Configuración mínima; el juego es 100% cliente.

// Versión de la app = fecha/hora del BUILD. En Vercel el build corre al hacer
// push, así que equivale al "timestamp del push". Se inyecta como __APP_VERSION__.
const buildDate = new Date();
const pad = (n) => String(n).padStart(2, '0');
const APP_VERSION = `${buildDate.getUTCFullYear()}-${pad(buildDate.getUTCMonth() + 1)}-${pad(buildDate.getUTCDate())} ${pad(buildDate.getUTCHours())}:${pad(buildDate.getUTCMinutes())} UTC`;

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION)
  },
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2020',
    sourcemap: true
  }
});
