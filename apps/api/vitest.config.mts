import { defineConfig } from 'vitest/config';

// Las pruebas viven en tests/ (raiz del repositorio) y se ejecutan en serie:
// las de integracion comparten una sola base de pruebas (se vacia entre pruebas).
export default defineConfig({
  test: {
    include: ['../../tests/unit/**/*.test.ts', '../../tests/integration/**/*.test.ts'],
    fileParallelism: false,
    environment: 'node',
    // Hilos en lugar de procesos: en Windows el pool 'forks' llego a morir al arrancar
    // (codigo 3221226505) de forma intermitente, sin relacion con las pruebas.
    pool: 'threads',
  },
});
