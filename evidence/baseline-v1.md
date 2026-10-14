# baseline-v1: recorrido completo con roles, inventario, auditoría y pruebas

Estado: **candidata, sin etiquetar.** La etiqueta `baseline-v1` la crea una persona (Luis) cuando el CI de `main` esté en verde en el commit exacto. No se mueve después.
SHA de la etiqueta: PENDIENTE (Luis). Fecha UTC de la etiqueta: PENDIENTE (Luis).

## Qué recorre

Identidad → borrador → envío → reserva → despacho → entrega → consulta de auditoría, por la API HTTP, contra PostgreSQL real, con cuatro roles y dos organizaciones.

| Paso | Ruta | Rol | Efecto verificado en la base |
|---|---|---|---|
| Iniciar sesión | `POST /auth/login` | Cualquiera | Sesión con solo el hash del token y vencimiento de 8 h |
| Crear y editar borrador | `POST /requests`, `PATCH /requests/{code}` | SOLICITANTE | Sin eventos de auditoría ni cambios de inventario |
| Enviar | `POST /requests/{code}/submit` | SOLICITANTE | Estado ENVIADA y un evento `ENVIAR` |
| Reservar | `POST /requests/{code}/reserve` | COORDINADOR | Todo o nada; `reserved` suma; un evento; llave de idempotencia |
| Cancelar | `POST /requests/{code}/cancel` | SOLICITANTE | Libera lo reservado (RESERVADA) o no toca inventario (ENVIADA) |
| Despachar | `POST /requests/{code}/dispatch` | BODEGA | Resta físico y reservado |
| Entregar | `POST /requests/{code}/deliver` | COORDINADOR | Sin cambio de inventario |
| Consultar | `GET /requests`, `/dashboard`, `/inventory`, `/audit` | Según rol | Filtradas por organización |

## Oráculos del caso verificados (base real)

| Escenario | Resultado esperado | Prueba |
|---|---|---|
| Reserva de A-001 | físico 10, reservado 7, disponible 3 | `AC-RF05-01` |
| Cancelación de esa reserva | físico 10, reservado 0, disponible 10 | `AC-RF06-01` |
| Despacho de esa reserva | físico 3, reservado 0, disponible 3 | `AC-RF06-02` |
| A-001 y A-002 a la vez (20 repeticiones) | una 200 y otra 409; 10/7/3; un evento | `AC-RNF02-01` |
| Una línea suficiente y otra insuficiente | ninguna línea ni estado cambia | `AC-RF05-02` |
| Misma llave y mismo contenido | un solo efecto | `AC-RF07-01` |
| Misma llave y contenido distinto | 409 | `AC-RF07-02` |
| Aislamiento entre organizaciones | 404 sin cambios en ORG-B | `AC-RF02-01` a `AC-RF02-04`, `AC-RNF01-04` |

## Pruebas (2026-10-14, árbol de trabajo)

Comando: `npm run verify`. Resultado: **159 pruebas ejecutadas, 159 pasaron, 0 fallaron, 0 omitidas** (lint, tipos y formato en verde).
Pruebas sobre el **árbol de trabajo** (HEAD `8bc3565` más cambios sin commit); deben repetirse sobre el SHA de `main` unido antes de marcar `Cumple`.

| Archivo | Pruebas |
|---|---|
| `tests/unit/safe-test-db.test.ts` | 8 |
| `tests/unit/contract.test.ts` | 1 |
| `tests/unit/entrega.test.ts` | 2 |
| `tests/integration/db.test.ts` | 29 |
| `tests/integration/auth-requests.test.ts` | 30 |
| `tests/integration/reserve.test.ts` | 23 |
| `tests/integration/security-queries.test.ts` | 32 |
| `tests/integration/concurrency.test.ts` | 4 |
| `tests/integration/ai.test.ts` | 30 |

Estado por AC en `evidence/spec-vs-code.csv`: 126 AC; **120 `Parcial`** (la prueba pasó en el árbol de trabajo, falta el SHA evaluado) y **6 `No cumple`** (sin prueba automática).

## Lo que se declara pendiente (y su impacto)

| Pendiente | Impacto |
|---|---|
| Interfaz web (R6): `AC-RNF05-01` a `AC-RNF05-03` y `AC-RF12-01` | Sin pantallas no hay flujo por interfaz ni E2E; RNF05 queda `No cumple` |
| Carga con k6 sobre 2.000 solicitudes (`AC-RNF03-01`) | RNF03 sin medir; el seed de carga existe y se aplica (`npm run seed:load`) |
| Clon limpio cronometrado y Docker Compose completo (`AC-RNF04-01`) | RNF04 parcial: solo migraciones, seed y versiones fijadas |
| Respuesta real de un LLM (`evidence/ai-real/respuesta.json`) | El proveedor `replay` degrada al alternativo; se declara en la sección de IA |
| Pruebas con dos instancias de la API o más de 15 peticiones simultáneas | El control de concurrencia se probó con un solo proceso |
| CI de GitHub sobre el SHA unido | Las 159 pruebas no se han ejecutado en GitHub Actions |
| SQL en Supabase | Pendiente de `SQL EJECUTADO` |

## Cómo reproducir

```bash
npm ci
npm run db:test:up
npm run verify
```
