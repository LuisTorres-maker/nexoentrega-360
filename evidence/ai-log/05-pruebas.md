# Intervención de IA

ID y fecha UTC: IA-05 / 2026-10-14T06:04:00Z
Autor: PENDIENTE (Andrés y Jhoimer) — quienes publican PR-7 y PR-8.
Etapa: Pruebas
Herramienta y modelo conocido: Claude Code (modelo informado por la sesión: Claude Sonnet 5.5, id claude-sonnet-5-5)
RF y AC: RF02, RF05, RF07, RF09, RNF01, RNF02 / AC-RF07-01 a AC-RF07-09, AC-RF02-01 a AC-RF02-09, AC-RNF01-01 a AC-RNF01-05, AC-RNF02-01 a AC-RNF02-05
Contexto y versiones de archivos: SPEC-001, SPEC-003, SPEC-004 v0.2; `tests/integration/*.test.ts`; `scripts/gen_evidencia.py`

## Objetivo

Pedir a la IA pruebas **adversariales** de idempotencia y aislamiento, y registrar cuáles se implementaron y cuáles se descartaron y por qué.

## Prompt enviado

«Propón pruebas adversariales para idempotencia (RF07) y aislamiento entre organizaciones (RF02, RNF01) que un revisor desconfiado escribiría; indica para cada una el oráculo.
No cambies reglas del caso. Después implementa las que se puedan ejecutar contra la base real de pruebas y descarta las que no.»

## Salida relevante

| Prueba adversarial propuesta | Decisión | Motivo |
|---|---|---|
| Dos peticiones simultáneas con la misma llave | Implementada (AC-RF07-09) | Verifica `pg_advisory_xact_lock`: ambas 200 y un solo evento |
| Misma llave de otra organización devuelve la respuesta ajena | Implementada (AC-RF07-04) | Oráculo: 200 con el cuerpo de B-001, nunca el de A-001 |
| Reintentar una llave tras un 409 por stock | Implementada (AC-RF07-05) | Confirma que los errores no se guardan |
| Reutilizar la llave pasadas 24 horas con otro contenido | Implementada (AC-RF07-06) | Reloj inyectado; se descubrió que la sesión también vence (error de la prueba) |
| Reservar con la respuesta guardada sin sesión o con otro rol | Implementada (AC-RF07-07) | 401 y 403 antes de mirar la llave |
| Fallo inyectado entre la primera y la segunda línea | Implementada (AC-RF07-08) | Gancho de prueba; sin reserva parcial, evento ni llave |
| Falla de la inserción de auditoría deja el cambio a medias | Implementada (AC-RF09-05) | Se fuerza con una restricción temporal que rechaza `RESERVAR`; estado e inventario intactos |
| Cancelar y despachar simultáneamente | Implementada (AC-RNF02-05) | 10 repeticiones; nunca valores intermedios |
| 15 solicitudes de 1 unidad con físico 10 | Implementada (AC-RNF02-02) | Exactamente 10 ganan y 5 reciben 409 |
| Cuerpo de error idéntico para B-001 y B-999, sin cabeceras con datos | Implementada (AC-RF02-09) | Compara cuerpos y cabeceras |
| `X-Org-Id` y `orgId` en el cuerpo | Implementada (AC-RNF01-03) | Se ignora el encabezado; el campo extra da 422 |
| Orden 401, 403, 404 al reservar B-001 | Implementada (AC-RNF01-05) | Tres identidades |
| Bloqueo de cuenta por intentos fallidos | **Descartada** | Fuera de alcance (SPEC-001 S2) |
| Carga con más de 100 peticiones simultáneas sobre un SKU | **Descartada por ahora** | Sin hardware definido; queda para R7 |
| Dos instancias de la API compitiendo | **Descartada por ahora** | Requiere Docker Compose completo (R7) |
| Fuga por tiempo de respuesta entre cuenta existente e inexistente | **Parcial** | El hash de relleno iguala el costo de bcrypt, pero no se midió |

## Decisión humana

PENDIENTE (Andrés, Jhoimer): qué pruebas se aceptan, se corrigen o se descartan.

## Verificación

`npm run verify`: 159 pruebas pasaron, 0 fallaron (2026-10-14). Ninguna prueba adversarial reveló un defecto del producto; los fallos encontrados estaban en el diseño de una prueba (ver IA-04).
Eso **no** prueba ausencia de defectos: ver «Límites».

## Límites

Pruebas escritas por la misma IA que escribió el código (sesgo de confirmación). Los oráculos salen del caso y de las SPECS, no del código, pero la revisión humana y la sesión adversarial de R7 siguen siendo necesarias.
