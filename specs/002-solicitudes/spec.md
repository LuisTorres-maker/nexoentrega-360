# SPEC-002 Solicitudes

Autor: PENDIENTE (Luis). Revisor: PENDIENTE (Carlos B). Fecha UTC: PENDIENTE (Luis). Commit: PENDIENTE (Luis).

## Propósito y actores

Que el solicitante cree, edite y envíe su solicitud de kits con datos válidos, y pueda cancelarla mientras esté ENVIADA.
Actor principal: SOLICITANTE. Los demás roles solo la consultan (SPEC-004) o la procesan (SPEC-003).

## Alcance y exclusiones

Incluye: crear borrador, editar borrador, enviar (BORRADOR a ENVIADA), cancelar una ENVIADA propia, todas las validaciones de RF03
y los criterios de interfaz a 390 y 1366 px (RNF05).
No incluye: reservar, despachar, entregar ni cancelar una RESERVADA (efectos de inventario, SPEC-003); listados y tablero (SPEC-004).

## Requisitos de referencia

RF03, RF04 (borrador, envío y cancelación propia) y RNF05.

## Historia de usuario y reglas

HU-02. Como solicitante quiero crear, editar y enviar mi solicitud con productos válidos.

Estados: `BORRADOR` (editable) → `ENVIADA`; `ENVIADA` → `CANCELADA` (solo el dueño). Toda otra transición responde 409 y no cambia nada.
El `code` lo genera el sistema (`SOL-000001`, y las sembradas `A-001`, `A-002`, `B-001`).

Validaciones de entrada (RF03 y Q1, Q3, Q8):

| Campo | Regla | Error |
|---|---|---|
| `zone` | NORTE, CENTRO, SUR, ORIENTE u OCCIDENTE | 422 |
| `priority` | NORMAL o ALTA | 422 |
| `requiredDate` | ISO 8601 en UTC; al **enviar** debe ser mayor o igual al momento de envío | 422 |
| `notes` | opcional, hasta 500 caracteres | 422 |
| `lines` | de 1 a 10 líneas; SKU distintos | 422 |
| `lines.N.sku` | código de un SKU **activo** que existe | 422 |
| `lines.N.quantity` | entero de 1 a 500 | 422 |
| campos desconocidos | no se aceptan | 422 |

## Entradas, proceso, salidas y casos límite

El bloque estructurado es la fuente vinculante.

<!-- spec-data:start -->
```json
{
  "id": "SPEC-002",
  "version": "0.2",
  "name": "Solicitudes",
  "story": {
    "id": "HU-02",
    "as": "solicitante de una organización comunitaria",
    "want": "crear, editar y enviar mi solicitud con productos válidos",
    "soThat": "el coordinador pueda evaluarla y reservar el inventario sin errores de datos"
  },
  "requirements": ["RF03", "RF04", "RNF05"],
  "description": "Ciclo de vida del borrador y del envío de una solicitud con validaciones estrictas, cancelación de una solicitud ENVIADA propia y criterios de uso en pantalla de computador y móvil.",
  "inputs": [
    { "field": "zone", "type": "enumeración", "validation": ["NORTE, CENTRO, SUR, ORIENTE u OCCIDENTE", "obligatoria"] },
    { "field": "priority", "type": "enumeración", "validation": ["NORMAL o ALTA", "obligatoria"] },
    { "field": "requiredDate", "type": "fecha ISO 8601 UTC", "validation": ["formato válido", "al enviar, mayor o igual al momento de envío según el reloj del servidor"] },
    { "field": "notes", "type": "cadena opcional", "validation": ["hasta 500 caracteres"] },
    { "field": "lines", "type": "arreglo de objetos", "validation": ["de 1 a 10 elementos", "SKU sin repetir"] },
    { "field": "lines.N.sku", "type": "código de SKU", "validation": ["existe", "está activo"] },
    { "field": "lines.N.quantity", "type": "entero", "validation": ["de 1 a 500", "sin decimales ni negativos"] },
    { "field": "code (ruta)", "type": "identificador", "validation": ["pertenece a la organización y al solicitante de la sesión"] },
    { "field": "cuerpo", "type": "objeto JSON estricto", "validation": ["sin campos extra", "JSON interpretable, si no 400 JSON_INVALIDO"] }
  ],
  "process": [
    "Autenticar y comprobar que el rol es SOLICITANTE (403 si no)",
    "Crear: validar el cuerpo completo, generar el code, guardar organización y solicitante desde la sesión y dejar estado BORRADOR",
    "Editar: buscar la solicitud propia (404 si no); si no es BORRADOR responder 409; validar y reemplazar los datos y las líneas",
    "Enviar: buscar la solicitud propia, exigir BORRADOR, volver a validar SKU activos, líneas y fecha contra el reloj, y en una transacción pasar a ENVIADA y registrar el evento ENVIAR",
    "Cancelar una ENVIADA: buscar la solicitud propia, exigir ENVIADA o RESERVADA, pasar a CANCELADA y registrar el evento CANCELAR en la misma transacción",
    "Crear y editar un borrador no genera evento de auditoría ni toca inventario"
  ],
  "outputs": [
    { "condition": "borrador válido", "result": "201 con code, estado BORRADOR, líneas y datos guardados" },
    { "condition": "campo inválido, repetido o fuera de rango", "result": "422 VALIDACION con el campo, sin crear ni modificar nada" },
    { "condition": "envío válido de un borrador propio", "result": "200 con estado ENVIADA y un evento ENVIAR; inventario sin cambios" },
    { "condition": "editar o enviar una solicitud que ya no es BORRADOR", "result": "409 ESTADO_INVALIDO y datos intactos" },
    { "condition": "cancelar una ENVIADA propia", "result": "200 con estado CANCELADA, un evento CANCELAR e inventario sin cambios" },
    { "condition": "solicitud de otro solicitante u otra organización", "result": "404 NO_ENCONTRADA" },
    { "condition": "rol distinto de SOLICITANTE", "result": "403 PROHIBIDO" }
  ],
  "businessRules": [
    "Una solicitud tiene de 1 a 10 líneas con SKU distintos y cada cantidad es un entero de 1 a 500",
    "Solo un borrador es editable",
    "La fecha requerida no puede ser anterior al momento de envío; se valida al enviar, no al guardar el borrador",
    "El SKU debe existir y estar activo al guardar y al enviar",
    "El solicitante y la organización salen de la sesión, nunca del cuerpo",
    "Solo el solicitante dueño envía y cancela su solicitud",
    "Crear o editar un borrador no es una transición y no se audita; enviar y cancelar sí",
    "Códigos de error: VALIDACION (422), JSON_INVALIDO (400), ESTADO_INVALIDO (409), NO_ENCONTRADA (404), PROHIBIDO (403)",
    "Interfaz: sin desbordamiento horizontal a 390 y 1366 px, flujo principal con teclado, etiquetas y errores asociados a su campo"
  ],
  "edgeCases": [
    "Cantidades 0, -3, 2.5 y 501 y los límites 1 y 500",
    "Diez líneas válidas (aceptadas) y once líneas (rechazadas)",
    "Observaciones de exactamente 500 y de 501 caracteres",
    "Fecha requerida igual al momento de envío (permitida)",
    "Borrador con fecha pasada que se guarda pero no se puede enviar",
    "SKU KIT-INACTIVO e inexistente",
    "Doble clic en Enviar: la segunda petición responde 409 y no duplica el evento",
    "Zona o prioridad en minúsculas"
  ],
  "acceptanceCriteria": [
    { "id": "AC-RF03-01", "given": "el solicitante de ORG-A autenticado y los SKU activos KIT-AGUA y KIT-HIGIENE", "when": "envía POST /requests con zone NORTE, priority NORMAL, requiredDate 2030-01-20T14:00:00Z y dos líneas distintas con cantidades 2 y 3", "then": "responde 201 con un code generado por el sistema, estado BORRADOR, solicitante y organización tomados de la sesión; el inventario no cambia y no hay evento de auditoría" },
    { "id": "AC-RF03-02", "given": "el solicitante de ORG-A autenticado y un SKU activo", "when": "envía una línea con cantidad 0", "then": "responde 422 VALIDACION con campo lines.0.quantity, no se crea solicitud y no cambia el inventario" },
    { "id": "AC-RF03-03", "given": "el solicitante de ORG-A autenticado", "when": "envía por separado cantidades -3, 2.5 y 501, y luego 1 y 500", "then": "las tres primeras responden 422 con campo lines.0.quantity y las dos últimas responden 201" },
    { "id": "AC-RF03-04", "given": "el solicitante de ORG-A autenticado", "when": "envía dos líneas con el mismo SKU KIT-AGUA", "then": "responde 422 VALIDACION con campo lines y no se crea solicitud" },
    { "id": "AC-RF03-05", "given": "el solicitante de ORG-A autenticado y tres SKU activos", "when": "envía 0 líneas, luego 11 líneas y luego 10 líneas distintas", "then": "las dos primeras responden 422 y la de 10 líneas responde 201" },
    { "id": "AC-RF03-06", "given": "el solicitante de ORG-A autenticado, el SKU inactivo KIT-INACTIVO y el código KIT-NOEXISTE que no existe", "when": "envía por separado una línea con cada uno", "then": "ambas respuestas son 422 VALIDACION con campo lines.0.sku y no se crea solicitud" },
    { "id": "AC-RF03-07", "given": "el solicitante de ORG-A autenticado", "when": "envía observaciones de 501 caracteres y luego de 500 caracteres", "then": "la de 501 responde 422 con campo notes y la de 500 responde 201" },
    { "id": "AC-RF03-08", "given": "el solicitante de ORG-A autenticado", "when": "envía zone ESTE, y luego priority URGENTE", "then": "ambas responden 422 VALIDACION con el campo zone y priority respectivamente" },
    { "id": "AC-RF03-09", "given": "el solicitante de ORG-A autenticado", "when": "envía un cuerpo válido con campos extra status igual a ENVIADA y code igual a A-900", "then": "responde 422 por campo extra, no se crea solicitud y el estado no puede fijarse desde el cliente" },
    { "id": "AC-RF03-10", "given": "el reloj en 2030-01-10T14:00:00Z y un borrador propio con requiredDate 2030-01-09T14:00:00Z", "when": "el solicitante lo guarda y luego lo envía", "then": "guardar responde 201 y enviar responde 422 con campo requiredDate; la solicitud sigue BORRADOR y no hay evento ENVIAR" },
    { "id": "AC-RF03-11", "given": "el reloj en 2030-01-10T14:00:00Z y un borrador propio con requiredDate 2030-01-10T14:00:00Z", "when": "el solicitante lo envía", "then": "responde 200 y la solicitud queda ENVIADA porque la fecha es igual al momento de envío" },
    { "id": "AC-RF03-12", "given": "un coordinador de ORG-A autenticado", "when": "envía POST /requests con un cuerpo válido", "then": "responde 403 PROHIBIDO y no se crea ninguna solicitud" },
    { "id": "AC-RF03-13", "given": "el solicitante de ORG-A autenticado", "when": "envía requiredDate con el texto 10/01/2030 y, en otra petición, un cuerpo que no es JSON", "then": "la fecha responde 422 con campo requiredDate y el cuerpo ilegible responde 400 JSON_INVALIDO" },
    { "id": "AC-RF03-14", "given": "el borrador propio A-003 con una línea de KIT-AGUA y luego el SKU KIT-AGUA desactivado antes del envío", "when": "el solicitante envía POST /requests/A-003/submit", "then": "responde 422 VALIDACION con campo lines.0.sku, A-003 sigue en BORRADOR y no se registra evento ENVIAR" },
    { "id": "AC-RF04-01", "given": "el borrador A-003 de ORG-A propiedad de org-a-solicitante@example.test", "when": "el dueño envía PATCH /requests/A-003 con zone SUR y una línea de 4 KIT-AGUA", "then": "responde 200, A-003 conserva su code y su estado BORRADOR y guarda zona SUR y la línea nueva" },
    { "id": "AC-RF04-02", "given": "solicitudes propias de org-a-solicitante@example.test en estado ENVIADA (A-001), RESERVADA, DESPACHADA, ENTREGADA y CANCELADA (A-004)", "when": "el dueño envía PATCH con otra zona sobre cada una", "then": "las cinco responden 409 ESTADO_INVALIDO y la zona, las líneas y el estado de cada solicitud no cambian" },
    { "id": "AC-RF04-03", "given": "el borrador A-003 de ORG-A con fecha requerida posterior al reloj 2030-01-10T14:00:00Z", "when": "el dueño envía POST /requests/A-003/submit", "then": "responde 200 y A-003 queda ENVIADA con exactamente un evento ENVIAR de BORRADOR a ENVIADA; el inventario de ORG-A no cambia" },
    { "id": "AC-RF04-04", "given": "el borrador A-003 propiedad de org-a-solicitante@example.test", "when": "org-a-solicitante2 envía POST /requests/A-003/submit y el coordinador de ORG-A envía lo mismo", "then": "el segundo solicitante recibe 404, el coordinador recibe 403 y A-003 sigue en BORRADOR sin eventos" },
    { "id": "AC-RF04-05", "given": "A-002 ENVIADA de ORG-A propiedad de org-a-solicitante@example.test", "when": "el dueño envía POST /requests/A-002/cancel", "then": "responde 200, A-002 queda CANCELADA y se registra exactamente un evento CANCELAR de ENVIADA a CANCELADA" },
    { "id": "AC-RF04-06", "given": "el borrador A-003 de ORG-A", "when": "el dueño envía POST /requests/A-003/cancel", "then": "responde 409 ESTADO_INVALIDO porque BORRADOR no puede cancelarse, y el estado y los datos no cambian" },
    { "id": "AC-RF04-07", "given": "A-002 ENVIADA de ORG-A", "when": "el coordinador de ORG-A y org-a-solicitante2 intentan POST /requests/A-002/cancel", "then": "el coordinador recibe 403, el otro solicitante recibe 404 y A-002 sigue ENVIADA" },
    { "id": "AC-RF04-08", "given": "A-001 ya ENVIADA", "when": "el dueño envía otra vez POST /requests/A-001/submit", "then": "responde 409 ESTADO_INVALIDO y no se crea un segundo evento ENVIAR" },
    { "id": "AC-RNF05-01", "given": "las pantallas Mis solicitudes y Nueva solicitud abiertas con el solicitante de ORG-A", "when": "se mide el ancho de página a 390 px y a 1366 px", "then": "document.documentElement.scrollWidth es menor o igual a window.innerWidth en ambos anchos y en ambas pantallas" },
    { "id": "AC-RNF05-02", "given": "el navegador sin usar el ratón", "when": "se recorre con Tab, Shift+Tab, Enter y Espacio el inicio de sesión, la creación de una solicitud con una línea y su envío", "then": "el flujo termina con la solicitud ENVIADA, el foco es visible en cada paso y ningún control queda fuera del orden de tabulación" },
    { "id": "AC-RNF05-03", "given": "el formulario Nueva solicitud con una cantidad 0 en la primera línea", "when": "se envía el formulario", "then": "cada campo tiene su etiqueta asociada, el error 422 aparece junto al campo con role alert y aria-describedby, y el botón se desactiva mientras envía" }
  ]
}
```
<!-- spec-data:end -->

## Datos y contrato esperado

| Método | Ruta | Quién | Éxito | Errores |
|---|---|---|---|---|
| POST | `/requests` | SOLICITANTE | 201 solicitud en BORRADOR | 400, 401, 403, 422 |
| PATCH | `/requests/{code}` | SOLICITANTE dueño | 200 solicitud actualizada | 401, 403, 404, 409, 422 |
| POST | `/requests/{code}/submit` | SOLICITANTE dueño | 200 solicitud ENVIADA | 401, 403, 404, 409, 422 |
| POST | `/requests/{code}/cancel` | SOLICITANTE dueño | 200 solicitud CANCELADA | 401, 403, 404, 409 |

Cuerpo de ejemplo: `{ "zone": "NORTE", "priority": "ALTA", "requiredDate": "2030-01-20T14:00:00Z", "notes": "Entrega comunitaria", "lines": [ { "sku": "KIT-AGUA", "quantity": 2 } ] }`.

Datos sembrados que usa esta SPEC (adiciones del equipo, documentadas en `docs/data-model.md`):
`A-003` BORRADOR de ORG-A, NORTE, NORMAL, 2030-01-15T14:00:00Z, 2 de KIT-AGUA, dueño `org-a-solicitante@example.test`.
`A-004` CANCELADA de ORG-A, CENTRO, NORMAL, 2030-01-13T14:00:00Z, 3 de KIT-HIGIENE, mismo dueño.
`KIT-INACTIVO` es un SKU inactivo sin inventario. Ninguna de estas adiciones toca KIT-ALIMENTO de ORG-A, así que los oráculos no cambian.

## Supuestos y preguntas

| ID | Supuesto o pregunta | Estado |
|---|---|---|
| Q1 | Zonas permitidas y zona desconocida (422). | Abierta, con supuesto provisional |
| Q2 | Fecha en ISO 8601 UTC; la interfaz muestra hora de Bogotá. | Abierta, con supuesto provisional |
| Q3 | Observaciones: máximo 500 caracteres. | Abierta, con supuesto provisional |
| Q8 | SKU inactivo o inexistente: 422. | Abierta, con supuesto provisional |
| S1 | El SKU se valida al guardar el borrador y de nuevo al enviar (puede desactivarse entre ambos momentos). | Supuesto del equipo |
| S2 | Un SOLICITANTE no puede cancelar un BORRADOR (no está en la lista de transiciones permitidas): responde 409. | Supuesto del equipo |

## Riesgos y pruebas previstas

| Riesgo | Control | Prueba prevista |
|---|---|---|
| Datos fuera de rango llegan a la base | Validación zod estricta y `CHECK` en la base | `tests/unit/solicitud.test.ts` y `tests/integration/requests.test.ts` |
| Doble envío por doble clic | 409 en el segundo envío y botón desactivado | AC-RF04-08 y AC-RNF05-03 |
| Edición de solicitud ya enviada | Estado comprobado en el servidor | AC-RF04-02 |
| Desborde en móvil | Verificación a 390 px | E2E con Playwright y lista manual de RNF05 |

## Cambios de versión

| Versión | Fecha UTC | Cambio |
|---|---|---|
| 0.1 | PENDIENTE (Luis) | Borrador inicial generado con Claude Code. |
| 0.2 | PENDIENTE (Luis) | Revisión crítica IA-02: nuevo AC-RF03-14 para el SKU desactivado entre el borrador y el envío, que el supuesto S1 afirmaba sin criterio de aceptación (H-04); AC-RF04-02 cubre todos los estados no borrador y no solo ENVIADA (H-05). |
