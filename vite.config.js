import { defineConfig } from 'vite';

// Vite es suficiente para servir ES modules y assets estáticos (GLB/texturas)
// desde /public. Configuración mínima; el juego es 100% cliente.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2020',
    sourcemap: true
  }
});
