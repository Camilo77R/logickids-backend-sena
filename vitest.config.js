import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup/cleanupTestFixtures.js'],
    // Los tests corren uno tras otro (no en paralelo) para no generar
    // conflictos en la base de datos de desarrollo
    fileParallelism: false,
    // Tiempo máximo de 15s por test (las llamadas a BD pueden tardar)
    testTimeout: 15000,
    // Muestra el nombre de cada test mientras corre (más legible)
    reporter: 'verbose',
  },
});
