# Defectos encontrados y su corrección

Registro de hallazgos **reales** (hallazgo, corrección y nueva verificación). Lo no encontrado no se inventa: ver «Qué se comprobó».
Los fallos de diseño de una prueba se anotan aparte (no son defectos del producto).

## Defectos del producto o del proceso

| ID | Fecha UTC | Quién lo encontró | Hallazgo | Corrección | Nueva verificación | Estado |
|---|---|---|---|---|---|---|
| D-01 | 2026-10-14 | Escáner de secretos (gitleaks) al revisar R7 | `evidence/tests/k6-resumen.json` exportaba `setup_data` con el **token de sesión** de la prueba de carga | Se eliminó `setup_data` del archivo y `scripts/load.mjs` lo borra siempre antes de guardar | `gitleaks detect`: «no leaks found» | Cerrado |
| D-02 | 2026-10-14 | `npm run verify` repetido | El pool `forks` de Vitest en Windows murió al arrancar en 2 de 4 corridas (código `3221226505`), sin fallo de pruebas | `pool: 'threads'` en `apps/api/vitest.config.mts` | 3 corridas seguidas con 159 de 159 | Cerrado, con vigilancia |
| D-03 | 2026-10-14 | Simulación de unión de los PR en orden (carpeta temporal con `TEST_DATABASE_URL` definida, como en el CI) | La prueba «rechaza una URL vacía o ausente» de `tests/unit/safe-test-db.test.ts` llamaba a `assertSafeTestDb(undefined)`, que lee `TEST_DATABASE_URL`; con la variable definida (CI) no lanzaba y la prueba fallaba. **Habría dejado en rojo el CI de PR-1** | La prueba quita la variable durante la comprobación y la restaura | Simulación de PR-1: `npm run test` en verde con la variable definida | Cerrado |

## Fallos de diseño de pruebas (no son del producto)

| ID | Hallazgo | Corrección |
|---|---|---|
| P-01 | AC-RF07-06 fallaba con 401: la sesión de 8 h ya había vencido con el reloj movido | Iniciar sesión de nuevo en la prueba |
| P-02 | `import './http/types'` de un `.d.ts` rompía en ejecución | Se quitó el import (los tipos entran por `tsconfig`) |
| P-03 | Un `;` dentro de un mensaje de `secuencia-ia.mmd` rompía Mermaid | Se reemplazó por una coma |
| P-04 | E2E: la lista ordena por fecha de creación y las solicitudes sembradas (2030) salían primero; el test tomaba la solicitud equivocada | Selector `li[data-codigo^="SOL-"]`; el orden de la API es el de la SPEC-004 |
| P-05 | E2E: el campo `datetime-local` tiene varios segmentos con foco y el recorrido con Tab se desalineaba | El test vuelve al flujo desde Observaciones |

## Qué se comprobó y no produjo defectos del producto

- 159 pruebas con base real (restricciones, transiciones, idempotencia, concurrencia, aislamiento, auditoría, IA) y 7 E2E.
- Prueba de carga: 0 errores en 44.859 peticiones; p95 de 41,5 ms.
- Respaldo y restauración: coinciden las 5 medidas comparadas.
- `npm audit --audit-level=high`: 0 vulnerabilidades.

**Pendiente:** la sesión adversarial de dos personas (`evidence/tests/sesion-adversarial.md`) todavía no se ejecutó.
