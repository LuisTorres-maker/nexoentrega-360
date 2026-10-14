# Modelo de datos de NexoEntrega 360

Versión: v0.1 (ronda R2). Esquema en `migrations/001_init.sql` y `migrations/002_security.sql`. Datos en `seeds/`.
Diagrama: `docs/diagramas/datos.mmd`. Decisiones: ADR-0001 (base de datos), ADR-0002 (transacciones) y ADR-0003 (sesiones).

## Principios

1. **Las reglas críticas viven en la base**, no solo en el código: una prueba que salta la API sigue chocando con la restricción (RNF02).
2. Todo recurso lleva su organización (`org_id`). Las consultas la reciben de la sesión, nunca del cliente.
3. El identificador público de una solicitud es su `code`. El `id` numérico no sale de la API.
4. Fechas en `timestamptz` (UTC). La interfaz las muestra en hora de Bogotá (Q2).
5. El historial de auditoría es de solo escritura: lo impone un disparador, no solo la ausencia de rutas.

## Tablas

| Tabla | Para qué | Clave | Restricciones que impone la base |
|---|---|---|---|
| `organizations` | ORG-A y ORG-B | `id` (texto) | — |
| `users` | Cuentas de los cuatro roles | `id`; `email` único | `email = lower(email)`; `role` en SOLICITANTE, COORDINADOR, BODEGA o AUDITOR |
| `sessions` | Sesiones opacas (solo hash del token) | `token_hash` | `expires_at > created_at`; se borran con el usuario |
| `skus` | Catálogo de kits | `id`; `code` único | — |
| `inventory` | Existencia y reserva por organización y SKU | (`org_id`, `sku_id`) | `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand` (disponible nunca negativo) |
| `requests` | Solicitudes | `id`; `code` único | `zone`, `priority` y `status` por `CHECK`; `notes` hasta 500 caracteres |
| `request_lines` | Líneas de cada solicitud | `id`; (`request_id`, `sku_id`) único | `quantity` entre 1 y 500; sin SKU repetido por solicitud |
| `audit_events` | Historial de transiciones y aprobaciones | `id` | `action` y `resource_type` por `CHECK`; `UPDATE` y `DELETE` rechazados por el disparador `audit_no_change` |
| `idempotency_keys` | Resultados exitosos de reservas | (`org_id`, `user_id`, `operation`, `key`) | `key` de 1 a 128 caracteres |
| `ai_summary_attempts` | Intentos de resumen de IA y su aprobación | `id` | de 1 a 20 `request_ids`; `approved_by` y `approved_at` van juntos |
| `schema_migrations` | Migraciones y seeds ya aplicados | `name` | — |

## Reglas de datos (qué las impone y qué prueba las verifica)

| Regla | La impone | Prueba (`tests/integration/db.test.ts`) |
|---|---|---|
| Reservado no supera el físico y nada es negativo (RF05) | `CHECK` en `inventory` | AC-RNF02-03: cuatro UPDATE directos fallan con código 23514 |
| Cantidad de línea de 1 a 500 (RF03) | `CHECK` en `request_lines` | AC-RF03-03 (base) |
| SKU único por solicitud (RF03) | `UNIQUE (request_id, sku_id)` | AC-RF03-04 (base) |
| Observaciones hasta 500 caracteres (Q3) | `CHECK` en `requests.notes` | AC-RF03-07 (base) |
| Zona, prioridad, estado y rol cerrados (Q1, RF04) | `CHECK` | prueba de valores del caso |
| Auditoría inmutable (RF09) | disparador `audit_readonly` | AC-RF09-03 (base): UPDATE y DELETE fallan con P0001 |
| Una llave por organización, usuario, operación y llave (RF07) | clave primaria compuesta | AC-RF07-04 (base) |
| Correo en minúsculas (SPEC-001 S3) | `CHECK (email = lower(email))` | prueba de cuentas |
| Sin lectura pública vía Supabase (RNF01) | `ENABLE ROW LEVEL SECURITY` sin políticas y `REVOKE` | prueba de RLS (11 tablas) |

Lo que **no** impone la base (lo imponen servicios y validadores): de 1 a 10 líneas por solicitud, SKU activo, fecha requerida mayor o igual
al momento de envío, orden de las transiciones y permisos por rol.

## Índices

| Índice | Para qué consulta |
|---|---|
| `requests_org_status`, `requests_org_priority`, `requests_org_zone` | Filtros del listado (RF08) |
| `requests_org_created` (`org_id`, `created_at DESC`, `id DESC`) | Orden y paginación del listado |
| `requests_requester` (`org_id`, `requester_id`, `created_at DESC`) | Listado del solicitante (solo las propias) |
| `audit_org_time` (`org_id`, `occurred_at DESC`, `id DESC`) | Consulta de auditoría paginada |
| `sessions_user`, `sessions_expires` | Cierre de sesión y limpieza de vencidas |
| `idempotency_created` | Limpieza de llaves de más de 24 horas |
| `inventory_sku` | Joins por SKU |

## Migraciones

| Archivo | Contenido | Se registra como |
|---|---|---|
| `migrations/001_init.sql` | Tablas, restricciones, índices, disparador y secuencia de códigos | `001_init.sql` |
| `migrations/002_security.sql` | RLS en las 11 tablas y revocaciones a `anon` y `authenticated` | `002_security.sql` |

Son **idempotentes** (`IF NOT EXISTS`, bloques `DO` y `ON CONFLICT DO NOTHING`) y se **auto-registran** en `schema_migrations`.
El mismo archivo sirve pegado en el SQL Editor de Supabase y aplicado por `npm run migrate` en una base local.
Si hay que corregir algo ya aplicado, se agrega una migración nueva (`003_...`); nunca se edita una ya aplicada.

## Seeds

| Archivo | Contenido | Quién lo ejecuta |
|---|---|---|
| `seeds/001_base.sql` | Estado inicial del caso (idempotente) | Persona en Supabase; `npm run seed` en local |
| `seeds/000_reset_demo.sql` | **Borra todo** y vuelve a sembrar el estado inicial | Solo ejecución manual de una persona |
| `seeds/002_load.sql` | 2.000 solicitudes `L-000001` a `L-002000` para la prueba de carga (RNF03) | `npm run seed:load` en local |

Los tres se generan con `npm run seed:gen` (`scripts/seed-gen.mjs`) y `npm run seed:check` comprueba que no divergen.
La clave de las cuentas es ficticia: sale de `DEMO_PASSWORD` y se guarda como hash bcrypt (coste 10) con una sal derivada del correo
para que la generación sea reproducible.

## Traducción de `docs/anexos/fixture-scenarios.json` al esquema

El archivo del caso describe **hechos**, no tablas. El generador lee ese archivo y los traduce así:

| Hecho del caso | Esquema | Nota |
|---|---|---|
| `organizations[]` | `organizations.id` | `name` lo agrega el equipo (`Organizacion comunitaria A`) |
| `stock[].organizationId` | `inventory.org_id` | |
| `stock[].sku` | `skus.code` (y `inventory.sku_id`) | El SKU es una fila de `skus`; `inventory` apunta a su `id` |
| `stock[].onHand` | `inventory.on_hand` | |
| `stock[].reserved` | `inventory.reserved` | 0 en el estado inicial |
| `stock[].active` | `skus.active` | |
| `accounts[].login` | `users.email` | Correo en minúsculas |
| `accounts[].role` | `users.role` | |
| `accounts[].organizationId` | `users.org_id` | |
| (sin equivalente) | `users.display_name`, `users.password_hash` | Nombre `Rol ORG-X` del equipo; hash de `DEMO_PASSWORD` |
| `requests[].requestId` | `requests.code` | Identificador público |
| `requests[].organizationId` | `requests.org_id` | |
| `requests[].ownerLogin` | `requests.requester_id` | Se resuelve por `users.email` |
| `requests[].status` | `requests.status` | `ENVIADA` sin reserva ni evento previo |
| `requests[].zona` | `requests.zone` | |
| `requests[].prioridad` | `requests.priority` | |
| `requests[].fechaRequerida` | `requests.required_date` | `timestamptz` |
| `requests[].observaciones` | `requests.notes` | |
| `requests[].lines[].sku` | `request_lines.sku_id` | Por `skus.code` |
| `requests[].lines[].quantity` | `request_lines.quantity` | |
| `clockUtc` | Reloj inyectado en pruebas | `2030-01-10T14:00:00Z`; no es una columna |

## Adiciones propias del equipo (no son del enunciado)

Se documentan aquí para que nadie las confunda con los hechos del caso. **No tocan KIT-ALIMENTO de ORG-A**, por eso los oráculos
(10/7/3, 10/0/10, 3/0/3) no cambian.

| Adición | Para qué | SPEC y AC |
|---|---|---|
| `org-a-solicitante2@example.test` (solicitante de ORG-A) | Probar que otro solicitante de la misma organización recibe 404 (Q6) | SPEC-001 AC-RF02-08 |
| `A-003` BORRADOR de ORG-A (NORTE, NORMAL, 2 de KIT-AGUA) | Editar, enviar y reservar un borrador (409) | SPEC-002 AC-RF04-01, SPEC-003 AC-RF05-03 |
| `A-004` CANCELADA de ORG-A (CENTRO, NORMAL, 3 de KIT-HIGIENE) | Transiciones inválidas y conteos del tablero | SPEC-004 AC-RF08-01 |
| `KIT-INACTIVO` (SKU inactivo, sin inventario) | 422 por SKU inactivo (Q8) | SPEC-002 AC-RF03-06 |
| Fechas de creación 2030-01-10 10:00 a 10:20 UTC (cada 5 min) | Orden estable del listado | SPEC-004 AC-RF08-01 |

Cuentas finales: 9 (8 oficiales y `org-a-solicitante2`). Solicitudes sembradas: 5 (`A-001`, `A-002`, `A-003`, `A-004` y `B-001`).

## Supuestos y límites

| Tema | Decisión |
|---|---|
| Código de solicitudes nuevas | `SOL-` y seis dígitos con una secuencia (`SOL-000001`). Una reinicialización de la demo reinicia la secuencia |
| Retención de llaves | Se conserva el resultado al menos 24 horas; una llave más vieja se trata como nueva y se sobrescribe. Sin tarea de limpieza (fuera de alcance) |
| Borrado de solicitudes | No existe; solo estados. `ON DELETE CASCADE` de las líneas solo sirve para reinicios y pruebas |
| `audit_events.user_id` | Referencia al usuario que ejecutó (no al solicitante); un usuario con eventos no se puede borrar |
| Seed de carga | Sin solicitudes RESERVADA, para no romper la regla «reservado igual a la suma de líneas RESERVADA»; es de solo lectura |
