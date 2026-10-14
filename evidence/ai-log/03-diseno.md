# Intervención de IA

ID y fecha UTC: IA-03 / 2026-10-14T05:23:06Z
Autor: PENDIENTE (Luis) — quien ejecutó la sesión de Claude Code y debe confirmar esta bitácora.
Etapa: Diseño
Herramienta y modelo conocido: Claude Code (modelo informado por la sesión: Claude Sonnet 5.5, id claude-sonnet-5-5)
RF y AC: RF05, RF06, RF07, RF09, RNF02 / AC-RF05-01, AC-RF05-02, AC-RF07-01 a AC-RF07-09, AC-RNF02-01 a AC-RNF02-05
Contexto y versiones de archivos: SPEC-003 v0.2, SPEC-001 v0.2, SPEC-004 v0.2, `migrations/001_init.sql`, `docs/adr/0002-transacciones-e-idempotencia.md`,
`scripts/experimento-reserva.mjs`

## Objetivo

Decidir cómo reservar inventario cuando dos peticiones compiten por el mismo stock (A-001 y A-002, 7 unidades cada una, físico 10): comparar
bloqueo pesimista, optimista y cola, y recomendar con argumentos y con una medición real, no solo de memoria.

## Prompt enviado

Resumen fiel del encargo: «Ejecuta R2. Compara bloqueo pesimista, optimista y cola para la reserva con dos peticiones simultáneas; registra tu recomendación y los
argumentos.» Instrucciones de trabajo vigentes: no inventar evidencia (lo medido se mide, lo no ejecutado se declara), Git de solo lectura, nada contra Supabase salvo
`db:check`, y todo experimento sobre la base local de pruebas.

## Salida relevante

1. **Recomendación:** bloqueo pesimista en la base (ADR-0002): `SELECT ... FOR UPDATE` sobre la solicitud y `UPDATE` condicional por línea, con la llave de
   idempotencia, el evento de auditoría y el cambio de estado en la **misma** transacción.
2. **Argumentos:**
   - Es correcto por construcción: el `UPDATE ... WHERE on_hand - reserved >= q` es atómico en la fila de inventario y, si afecta 0 filas, la transacción se deshace.
   - No necesita reintentos del cliente ni del servidor.
   - No depende de que haya un solo proceso (a diferencia de la cola en la aplicación).
   - La restricción `CHECK (reserved <= on_hand)` queda como segunda barrera.
3. **Experimento real** (`scripts/experimento-reserva.mjs`, PostgreSQL 16.4 local, Node 24.15.0): corrida de 30 repeticiones y otra de 50 (2026-10-14).

   | Escenario | Estrategia | Correctas (50 corridas) | Mediana ms |
   |---|---|---|---|
   | Dos de 7, físico 10 | Pesimista | 50 de 50 | 5,8 |
   | Dos de 7, físico 10 | Optimista | 50 de 50 | 9,8 |
   | Dos de 7, físico 10 | Cola en la aplicación | 50 de 50 | 7,6 |
   | Dos de 7, físico 10 | Ingenua (control negativo) | 0 de 50 | 22,8 |
   | Quince de 1, físico 10 | Pesimista | 50 de 50 | 36,5 |
   | Quince de 1, físico 10 | Optimista (10 reintentos sin espera) | 13 de 50 | 139,7 |
   | Quince de 1, físico 10 | Cola en la aplicación | 50 de 50 | 58,8 |
   | Quince de 1, físico 10 | Ingenua (control negativo) | 0 de 50 | 29,7 |

   La corrida de 30 repeticiones dio los mismos patrones (optimista 10 de 30 con quince competidoras).
4. **Lo que la IA descartó o relativizó:**
   - El bloqueo optimista no es «incorrecto»: con mejor espera y más reintentos podría acercarse; se descartó porque su corrección depende de un parámetro de reintentos.
   - La cola en la aplicación acertó en la medición, pero el experimento tiene un solo proceso; con dos instancias volvería la carrera. Es un argumento, no una medición.
5. **Decisiones de diseño derivadas:** orden fijo de SKU para evitar interbloqueos, `pg_advisory_xact_lock` por llave para serializar repeticiones simultáneas con la misma clave
   y guardar solo las respuestas exitosas (Q5).

## Decisión humana

PENDIENTE (Andrés y Luis): Aceptada | Corregida | Descartada, con motivo. Quien implemente la reserva en R3 debe repetir el experimento o verificar el resultado.

## Verificación

- Comando: `node scripts/experimento-reserva.mjs 30` y `node scripts/experimento-reserva.mjs 50`, 2026-10-14, contra `localhost:54329` (PostgreSQL 16.4 en Docker). Resultado: tabla anterior.
- Comando: `npm run test` con `tests/integration/db.test.ts`: las restricciones `CHECK` de inventario rechazan UPDATE directos (AC-RNF02-03); 29 pruebas de base en verde.
- No ejecutado: la prueba de concurrencia a través de la API (R4) ni con más de 15 peticiones simultáneas.

## Límites

Una sola máquina (Windows 11, Docker Desktop), un solo proceso cliente y una sola corrida de cada tamaño. Las latencias son orientativas y no equivalen a la prueba de carga (RNF03).
El experimento usa un esquema propio (`exp_reserva`) y no las tablas de la aplicación. Sin claves ni datos reales.
