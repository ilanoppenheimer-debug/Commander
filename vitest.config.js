// Config de tests, separada de vite.config.js a propósito: `vite build` no la lee,
// así el build y el bundle no cambian. Los tests viven en tests/, fuera de src/.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // globalSetup corre en el proceso principal ANTES de crear los workers, que heredan
    // el TZ. setupFiles lo reafirma dentro de cada worker (ver tests/environment.test.js).
    globalSetup: ['tests/globalSetup.js'],
    setupFiles: ['tests/setup.js'],
  },
});
