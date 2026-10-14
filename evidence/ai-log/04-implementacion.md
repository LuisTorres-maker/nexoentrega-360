# Intervención de IA

ID y fecha UTC: IA-04 / 2026-10-14T06:03:00Z
Autor: PENDIENTE (Andrés y Jhoimer) — quienes publican PR-7 y PR-8 y deben confirmar esta bitácora.
Etapa: Implementación
Herramienta y modelo conocido: Claude Code (modelo informado por la sesión: Claude Sonnet 5.5, id claude-sonnet-5-5)
RF y AC: RF01 a RF09, RNF01, RNF02 / AC-RF05-01 a AC-RF05-06, AC-RF06-01 a AC-RF06-05, AC-RF07-01 a AC-RF07-09, AC-RF01-01 a AC-RF01-09, AC-RF02-01 a AC-RF02-09
Contexto y versiones de archivos: SPEC-001, SPEC-002, SPEC-003, SPEC-004 v0.2; `docs/adr/0002-transacciones-e-idempotencia.md` v1; `docs/adr/0003-autenticacion-y-aislamiento.md` v1; `contracts/openapi.yaml`; `migrations/001_init.sql`

## Objetivo

Implementar el recorrido completo por API con base real: identidad con sesión opaca, borradores y envío, reserva atómica con idempotencia, cancelación,
despacho, entrega, consultas y auditoría, siguiendo las SPECS y los ADR, sin cambiar las reglas del caso.

## Prompt enviado

Prompt de trabajo (resumido, con la estructura pedida en R3-07):

- **Tarea:** implementar `reserve` (y `cancel`, `dispatch`, `deliver`, `submit`) como servicios transaccionales y exponerlos con `createApp({ pool, clock, aiProvider })`.
- **AC:** los de SPEC-003 (AC-RF05, AC-RF06, AC-RF07, AC-RNF02) y SPEC-001 y SPEC-002 en lo que toca a permisos y validación.
- **Archivos permitidos:** `apps/api/src/{domain,http,security,services,routes}`, `apps/api/src/app.ts`, `tests/` y `tests/helpers/`. Sin tocar migraciones ya diseñadas.
- **Restricciones:** SQL siempre parametrizado; organización y rol desde la sesión; una transacción por operación con bloqueo `FOR UPDATE`, `UPDATE` condicional por línea en orden fijo
  de SKU, evento de auditoría y llave de idempotencia en la misma transacción; solo se guardan respuestas exitosas; reloj inyectable; errores con formato uniforme y sin trazas.
- **Verificación:** `npm run verify`; oráculos escritos antes de ejecutar (10/7/3, 10/0/10, 3/0/3); pruebas contra PostgreSQL real; concurrencia de 20 repeticiones.

## Salida relevante

- `apps/api/src/services/transitions.ts`: `reservar`, `cancelar`, `despachar`, `entregar` y `enviar`. La reserva toma `pg_advisory_xact_lock` por llave, consulta la llave con retención de 24 horas
  (con el reloj inyectado), bloquea la solicitud filtrando por organización, reserva cada línea con `UPDATE ... WHERE on_hand - reserved >= q` y, si una línea no aplica, lanza
  `STOCK_INSUFICIENTE`, lo que provoca `ROLLBACK` completo.
- `apps/api/src/security/auth.ts`: bcrypt con hash de relleno para igualar tiempos, token de 32 bytes, solo `SHA-256` en la base, `authenticate` y `requireRole`.
- `apps/api/src/app.ts`: orden de controles correlationId, autenticar, rol, recurso, validación, ejecución; JSON se interpreta después del rol; 404 uniforme para rutas desconocidas.
- `tests/integration/reserve.test.ts`, `auth-requests.test.ts`, `security-queries.test.ts` y `concurrency.test.ts`.

**Lo que no salió bien a la primera (registrado tal cual):**

1. Un `import './http/types'` de un archivo `.d.ts` falló en tiempo de ejecución (`Cannot find module`); se quitó (la augmentación de tipos entra por `tsconfig`).
2. La prueba de AC-RF07-06 falló con 401: la sesión de 8 horas ya había vencido con el reloj movido a «mañana». El error estaba en el **diseño de la prueba**, no en el producto; se corrigió iniciando sesión de nuevo.
3. ESLint rechazó parámetros sin usar y un acceso con salto de línea; se corrigieron.
4. El formateador convirtió `﻿` en un carácter invisible que ESLint no admite; se reescribió como escape.
5. Al repetir `npm run verify` se observó un fallo **intermitente** del arnés: el proceso de un worker de Vitest murió al arrancar (código de salida de Windows `3221226505`, 2 de 4 corridas con el pool `forks`), sin que fallara ninguna prueba. Se cambió `apps/api/vitest.config.mts` a `pool: 'threads'` y se repitió; ver la sección de verificación.

## Decisión humana

PENDIENTE (Andrés, Jhoimer): Aceptada | Corregida | Descartada, con motivo.

## Verificación

- `npm run verify` el 2026-10-14: 159 pruebas pasaron, 0 fallaron (lint, tipos y formato en verde); `npm run build` sin errores. Con el pool `forks` hubo 2 corridas de 4 con un worker muerto al arrancar (ver 5 arriba); con `pool: 'threads'`, 3 corridas seguidas con 159 de 159.
- `AC-RNF02-01` con 20 repeticiones y `AC-RNF02-05` con 10 repeticiones: sin carreras observadas.
- Las pruebas corrieron sobre el árbol de trabajo (HEAD `8bc3565` más cambios sin commit), **no** sobre un SHA unido: los estados en `evidence/spec-vs-code.csv` son `Parcial` por eso.

## Límites

Una sola máquina y un solo proceso de aplicación; sin pruebas con dos instancias de la API. `/health` y `/ready` se probaron con una base simulada. El detalle de la interfaz y la carga (k6) no existen aún.
Sin claves ni datos reales.
