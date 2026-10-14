# Plan técnico de NexoEntrega 360

Spec y versión: SPEC-001 a SPEC-005, todas en v0.2 (126 criterios de aceptación).
Versión del plan: v0.1 (ronda R2). Estado: borrador para revisión de G2.
Autor: PENDIENTE (Luis). Revisor: PENDIENTE (Carlos B). Fecha UTC: PENDIENTE (Luis). Commit: PENDIENTE (Luis).

## Arquitectura y límites

Monolito modular (ADR-0001): una API Node y Express con capas, una web React y una base PostgreSQL. Diagramas en `docs/diagramas/`:
`contexto.mmd` (actores), `contenedores.mmd` (fronteras de confianza), `estados.mmd`, `datos.mmd`, `secuencia-reserva.mmd` y `secuencia-ia.mmd`.

| Capa | Carpeta | Responsabilidad | Regla |
|---|---|---|---|
| Rutas | `apps/api/src/routes/` | HTTP, validar entrada con zod, aplicar autenticación, rol y organización | No contiene reglas de negocio |
| Servicios | `apps/api/src/services/` | Reglas de negocio y transacciones (reservar, cancelar, despachar, entregar, enviar, IA) | Una transacción por operación |
| Dominio | `apps/api/src/domain/` | Enumeraciones, máquina de estados y validadores puros | Sin entrada ni salida |
| Datos | `apps/api/src/db/` | SQL parametrizado con `pg` | Nunca concatena texto del usuario |
| Seguridad | `apps/api/src/security/` | Sesiones, hash, middlewares `authenticate` y `requireRole` | Rol y organización salen de la sesión |
| IA | `apps/api/src/ai/` | Interfaz `AiProvider`, proveedores, validador estricto y alternativo | La IA no escribe datos |
| Web | `apps/web/` | Pantallas por rol | No decide permisos |

Fronteras de confianza: navegador (no confiable), servidor propio (confiable) y proveedor de IA (no confiable). Los datos que cruzan cada frontera
se validan al entrar y al salir.

## Tecnologías y versiones

Versiones fijadas con `package-lock.json` (README, sección «Versiones instaladas»). Candidatas para las rondas siguientes (versión consultada con `npm view`, se
fija al instalar): express 4.22.3, zod 4.6.7, pino 10.4.0, supertest 7.3.1, ajv 8.20.0, react 19.3.0, vite 8.3.4, @playwright/test 1.64.0.

| Necesidad | Herramienta | Versión instalada hoy |
|---|---|---|
| Lenguaje | TypeScript, modo estricto | 6.0.3 |
| Ejecución | Node.js | 24.15.0 |
| Base de datos | PostgreSQL | 16.4 (local) · 17.11 (Supabase, verificado) |
| Cliente SQL | pg | 8.23.1 |
| Hash de contraseñas | bcryptjs | 3.0.3 |
| Pruebas | Vitest | 5.0.4 |
| Contrato | OpenAPI 3.1.1 y @redocly/cli | 2.63.0 (vía `npx`) |
| Diagramas | Mermaid (valida con `@mermaid-js/mermaid-cli`) | 11.4.2 (vía `npx`) |

## Modelo de datos y migración

Detalle en `docs/data-model.md`. Once tablas; restricciones en la base. Migraciones idempotentes y auto-registradas (`001_init.sql`, `002_security.sql`),
aplicables a Supabase (SQL Editor) y a una base local (`npm run migrate`). Seeds generados por `npm run seed:gen`: `001_base.sql`, `000_reset_demo.sql`
(solo manual) y `002_load.sql` (2.000 solicitudes).

## Contratos

- HTTP: `contracts/openapi.yaml` (OpenAPI 3.1.1, 19 operaciones en 17 rutas). Validado con `npx @redocly/cli lint` sin errores ni advertencias.
- IA: `contracts/ai-output.schema.json` (copia idéntica del anexo, referenciada desde `openapi.yaml`).
- Formato de error uniforme: `{ error, mensaje, campo, correlationId }`.
- Códigos de error: `NO_AUTENTICADO`, `CREDENCIALES_INVALIDAS`, `PROHIBIDO`, `NO_ENCONTRADA`, `VALIDACION`, `JSON_INVALIDO`, `ESTADO_INVALIDO`,
  `STOCK_INSUFICIENTE`, `LLAVE_REQUERIDA`, `LLAVE_CON_OTRO_CONTENIDO`, `RESUMEN_YA_APROBADO` y `ERROR_INTERNO`.
- Identificador público de solicitud: `code`.

## Transacciones e idempotencia

ADR-0002. Una transacción por transición con bloqueo de la solicitud (`FOR UPDATE` por organización), `UPDATE` condicional por línea en orden fijo de SKU,
evento de auditoría y llave de idempotencia en la misma transacción. Llave: organización, usuario, operación y llave; solo se guardan respuestas exitosas;
retención mínima de 24 horas. Experimento de apoyo en `scripts/experimento-reserva.mjs`.

## Autenticación y permisos

ADR-0003. Sesión opaca con hash SHA-256 y bcrypt para contraseñas. Orden de controles: correlationId, autenticar (401), rol (403), recurso por
organización (404), validación (400 o 422), ejecución. Matriz de permisos en SPEC-001.

## IA y fallback

ADR-0004. `AiProvider` intercambiable (`fixture`, `replay`, `http`, `off`), validación estricta en esquema y en código, timeout de 5 s y resumen determinista
alternativo. La IA no tiene permisos de escritura.

## Pruebas y operación

| Familia | Dónde | Herramienta | Ronda |
|---|---|---|---|
| Base (restricciones, seed, RLS) | `tests/integration/db.test.ts` | Vitest y PostgreSQL local | R2 (hecha) |
| Dominio | `tests/unit/` | Vitest | R3 y R4 |
| API y base real | `tests/integration/` | Vitest, Supertest, PostgreSQL | R3 y R4 |
| Concurrencia (20 repeticiones) | `tests/integration/concurrency.test.ts` | Vitest `Promise.all` | R4 |
| Seguridad y aislamiento | `tests/integration/security.test.ts` | Vitest, Supertest | R3 y R4 |
| IA (7 fixtures) | `tests/integration/ai.test.ts` | Vitest | R5 |
| E2E y RNF05 | `tests/e2e/` | Playwright | R6 |
| Carga y clon limpio | `loadtest/`, `scripts/clon-limpio.sh` | k6 y Docker | R7 |

Operación: `/health` (proceso vivo) y `/ready` (la base responde), logs con `correlationId` y sin secretos, Docker Compose completo en R7.

## Diagramas

| Diagrama | Archivo | Qué muestra |
|---|---|---|
| Contexto | `docs/diagramas/contexto.mmd` | Actores y el proveedor de IA opcional |
| Contenedores y fronteras | `docs/diagramas/contenedores.mmd` | Web, API, adaptador de IA, Postgres local y Supabase |
| Estados | `docs/diagramas/estados.mmd` | Transiciones y quién las ejecuta |
| Datos | `docs/diagramas/datos.mmd` | Tablas y relaciones |
| Secuencia de reserva | `docs/diagramas/secuencia-reserva.mmd` | Dos reservas simultáneas |
| Secuencia de IA | `docs/diagramas/secuencia-ia.mmd` | Consulta con fallo y aprobación |

Los seis se renderizaron sin errores con `@mermaid-js/mermaid-cli` 11.4.2 el 2026-10-14.

## Decisiones ADR

| ADR | Decisión | Archivo |
|---|---|---|
| 0001 | Monolito modular; Supabase para la demo y Postgres local para pruebas y arranque reproducible | `docs/adr/0001-estructura-y-limites.md` |
| 0002 | Bloqueo pesimista, `UPDATE` condicional y llaves de idempotencia en la misma transacción | `docs/adr/0002-transacciones-e-idempotencia.md` |
| 0003 | Sesión opaca con hash; rol y organización desde la base | `docs/adr/0003-autenticacion-y-aislamiento.md` |
| 0004 | Interfaz de proveedor, validación estricta, timeout y alternativo determinista | `docs/adr/0004-integracion-de-ia-y-degradacion.md` |

## Revisión de coherencia

Revisión hecha por la IA al cerrar R2 contra SPEC-001 a SPEC-005, el contrato y el esquema. La persona revisora debe repetirla (columna «Revisor»).

| Hallazgo | Artefactos afectados | Acción | Revisor | Commit |
|---|---|---|---|---|
| El diseño de referencia numeraba el recurso de auditoría con el id interno; las SPECS usan el `code` (y `AI_SUMMARY` para aprobaciones) | `migrations/001_init.sql`, SPEC-004, `openapi.yaml` | `resource_id` guarda el `code`; `resource_type` solo admite `REQUEST` o `AI_SUMMARY` | PENDIENTE (Carlos B) | PENDIENTE |
| SPEC-001 exige 9 cuentas y correo sin distinguir mayúsculas | `migrations/001_init.sql`, `seeds/001_base.sql` | `CHECK (email = lower(email))` y 9 cuentas en el seed | PENDIENTE (Carlos B) | PENDIENTE |
| SPEC-003 AC-RF07-06: la llave pasadas 24 horas es nueva aunque el contenido sea distinto | ADR-0002, `idempotency_keys` | La llave guarda `created_at` y la regla de 24 horas es de servicio, con reloj inyectado | PENDIENTE (Carlos B) | PENDIENTE |
| El `openapi.yaml` agrega `requesterName` al detalle, que SPEC-002 no menciona | `contracts/openapi.yaml` | Campo de solo lectura para la bandeja del coordinador; no se envía al adaptador de IA (AC-RF10-02) | PENDIENTE (Carlos B) | PENDIENTE |
| El ID de la ruta `/ai/summaries/{id}/approve` es el intento guardado (SPEC-005 S4), no el `code` | `contracts/openapi.yaml`, SPEC-005 | Documentado en el contrato; se busca siempre filtrando por organización | PENDIENTE (Carlos B) | PENDIENTE |
| SPEC-004 pide «disponible» y la base no lo guarda | `contracts/openapi.yaml`, `docs/data-model.md` | `available = on_hand - reserved` se calcula en la consulta, nunca se almacena | PENDIENTE (Carlos B) | PENDIENTE |
