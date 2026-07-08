import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup/cleanupTestFixtures.js'],
    // Los tests corren uno tras otro (no en paralelo) para no generar
    // conflictos en la base de datos de desarrollo
    fileParallelism: false,
    // Son pruebas de integración reales contra BD y sockets; en Railway/Render
    // pueden superar 15s sin que la lógica esté rota.
    testTimeout: 60000,
    // Muestra el nombre de cada test mientras corre (más legible)
    reporter: 'verbose',
  },
});
