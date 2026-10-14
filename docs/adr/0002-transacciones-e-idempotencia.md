# ADR 0002 Transacciones e idempotencia

Estado: propuesto
Fecha y versión: 2026-10-14 / v1

## Contexto y restricciones

El problema central del cliente es prometer dos veces el mismo inventario. RF05 exige reserva total o nula con disponible no negativo,
RF06 define los efectos de cancelar, despachar y entregar, RF07 exige operación segura ante concurrencia e idempotencia (misma llave y
contenido repite el resultado; misma llave con otro contenido responde 409; resultado conservado al menos 24 horas), RF09 pide que estado,
inventario y evento se persistan de forma consistente y RNF02 pide verificarlo contra una **base real**.

## Alternativas consideradas

1. **Bloqueo pesimista en la base.** `SELECT ... FOR UPDATE` sobre la solicitud y un `UPDATE` condicional por línea
   (`WHERE on_hand - reserved >= cantidad`) en orden fijo de SKU, todo en una transacción.
   Ventajas: correcto por construcción, sin reintentos, fácil de probar. Desventajas: las peticiones sobre el mismo SKU esperan una a otra.
2. **Bloqueo optimista con columna de versión y reintentos.**
   Ventajas: no retiene bloqueos. Desventajas: bajo competencia genera reintentos y errores que hay que acotar.
3. **Cola de trabajos en la aplicación** (un trabajador que serializa las reservas).
   Ventajas: sin condiciones de carrera dentro de un proceso. Desventajas: solo protege a **un** proceso; con dos instancias vuelve la carrera
   y hay que mantener la cola.
4. **Sin control** (leer y luego escribir). Se usó solo como control negativo.

## Criterios de elección

Correctitud bajo concurrencia (lo primero), simplicidad, latencia, facilidad de prueba y que no dependa de que haya un solo proceso.

## Decisión y justificación

Elegimos la **alternativa 1**, con estas reglas (DEBE):

1. Toda transición cambia en **una sola transacción**: estado, inventario, evento de auditoría y llave de idempotencia. Cualquier error deshace todo.
2. La solicitud se bloquea con `SELECT ... FOR UPDATE` filtrando por la **organización de la sesión** (otra organización: 404).
3. La reserva exige estado `ENVIADA`; cada línea se reserva con `UPDATE` condicional y, si una no aplica, `ROLLBACK` completo y 409 `STOCK_INSUFICIENTE`.
4. Las líneas se procesan en **orden fijo de SKU** para evitar interbloqueos.
5. **Idempotencia** (RF07 y Q5): la llave exige el encabezado `Idempotency-Key` (400 si falta, después de autenticar, autorizar y buscar el recurso).
   Alcance: organización, usuario, operación y llave. Se calcula un hash del contenido `{operación, código de solicitud}`.
   Dos peticiones simultáneas con la misma llave se serializan con `pg_advisory_xact_lock`. Se guarda **solo** la respuesta exitosa
   (los errores 4xx y 5xx no se guardan y se pueden reintentar con la misma llave). Una llave de más de 24 horas se trata como nueva.
6. Cancelar una RESERVADA libera `reserved`; despachar baja `on_hand` y `reserved`; entregar y cancelar una ENVIADA no tocan inventario.
7. Las restricciones `CHECK` de la base (`reserved >= 0`, `on_hand >= 0`, `reserved <= on_hand`) son la **última** barrera, además del código.

### Evidencia del experimento (`scripts/experimento-reserva.mjs`)

Corrida real del 2026-10-14 contra PostgreSQL 16.4 local (Docker), Node 24.15.0, 50 repeticiones por celda. «Correctas» es que ganaran exactamente
las peticiones esperadas y que `reserved` terminara en el valor esperado sin errores inesperados.

| Escenario | Estrategia | Correctas | Mediana (ms) |
|---|---|---|---|
| Dos de 7 con físico 10 | Pesimista | 50 de 50 | 5,8 |
| Dos de 7 con físico 10 | Optimista (10 reintentos) | 50 de 50 | 9,8 |
| Dos de 7 con físico 10 | Cola en la aplicación | 50 de 50 | 7,6 |
| Dos de 7 con físico 10 | Ingenua sin bloqueo (control negativo) | **0 de 50** | 22,8 |
| Quince de 1 con físico 10 | Pesimista | 50 de 50 | 36,5 |
| Quince de 1 con físico 10 | Optimista (10 reintentos) | **13 de 50** | 139,7 |
| Quince de 1 con físico 10 | Cola en la aplicación | 50 de 50 | 58,8 |
| Quince de 1 con físico 10 | Ingenua sin bloqueo (control negativo) | **0 de 50** | 29,7 |

Lectura honesta: el control negativo falla siempre, lo que confirma que el escenario sí expone la carrera. La estrategia optimista de esta prueba
usa 10 reintentos sin espera y se agota con 15 competidoras; con más reintentos o espera podría mejorar, pero seguiría dependiendo de ellos.
La cola en la aplicación fue correcta porque el experimento tiene **un solo proceso**; no se midió con dos instancias (es un argumento, no una medición).

## Consecuencias y riesgos

Positivas: ninguna doble reserva; sin reintentos del cliente; inventario nunca negativo por construcción y por restricción.
Riesgos: las reservas del mismo SKU se serializan (aceptable: el caso tiene pocas peticiones simultáneas); una llave retenida solo 24 horas
significa que un reintento tardío se evalúa como operación nueva. Residual: bajo; falta probar con más de 15 peticiones simultáneas.

## RF y AC afectados

RF05, RF06, RF07, RF09, RNF02 / AC-RF05-01, AC-RF05-02, AC-RF06-01, AC-RF06-02, AC-RF07-01 a AC-RF07-09, AC-RNF02-01 a AC-RNF02-05.

## Verificación de la decisión

Verificado el 2026-10-14 sobre el árbol de trabajo (base `8bc3565` más cambios sin commit; falta repetirlo sobre el SHA unido):

- Experimento `scripts/experimento-reserva.mjs` (R2): ver tabla de la sección anterior.
- `tests/integration/reserve.test.ts` (23 pruebas): oráculos 10/7/3 (`AC-RF05-01`), 10/0/10 (`AC-RF06-01`) y 3/0/3 (`AC-RF06-02`); todo o nada (`AC-RF05-02`); idempotencia con misma llave y contenido (`AC-RF07-01`),
  contenido distinto (`AC-RF07-02`), error no guardado (`AC-RF07-05`), retención de 24 horas con reloj inyectado (`AC-RF07-06`), fallo antes del commit (`AC-RF07-08`) y llaves simultáneas (`AC-RF07-09`).
- `tests/integration/concurrency.test.ts` (4 pruebas): `AC-RNF02-01` con 20 repeticiones sin carreras; `AC-RNF02-02` con 15 solicitudes (10 ganan y 5 reciben 409); `AC-RNF02-04` y `AC-RNF02-05`.
- `tests/integration/db.test.ts` (29 pruebas): `CHECK` de inventario (`AC-RNF02-03`).

Pendiente: repetir sobre el SHA de `main`; dos instancias de la API; más de 15 peticiones simultáneas.

## Autor y revisión humana

Autor: PENDIENTE (Andrés). Revisor: PENDIENTE (Luis). Fecha UTC: PENDIENTE (Andrés). Commit: PENDIENTE (Andrés).
