# Lista de comprobación de RNF05 (interfaz usable en computador y móvil)

Alcance: verificación **manual** por personas y pruebas automáticas posibles. No se afirma conformidad total con WCAG.

## Parte automática (Playwright, 2026-10-14, árbol de trabajo)

| Comprobación | Prueba | Resultado |
|---|---|---|
| Sin desbordamiento horizontal a 390 px (inicio de sesión, mis solicitudes, nueva solicitud, tablero, bandeja, auditoría) | `AC-RNF05-01` | Pasó |
| Sin desbordamiento horizontal a 1366 px (las mismas pantallas) | `AC-RNF05-01` | Pasó |
| Login y creación de una solicitud con teclado (Tab, Enter) | `AC-RNF05-02` | Pasó |
| Error 422 asociado al campo con `aria-describedby`, `aria-invalid` y `role="alert"` | `AC-RNF05-03` | Pasó |

Comando: `npm run up && npm run e2e` (7 pruebas, 7 pasaron). Alcance de la prueba de teclado: el campo de fecha se llena con `fill` (tiene varios segmentos de foco).

## Parte manual (la completan **dos personas**, con fecha real)

Persona verificadora: PENDIENTE (Said / Carlos C). Fecha UTC: PENDIENTE. Navegador y versión: PENDIENTE. Commit evaluado: PENDIENTE.

| # | Comprobación | Resultado | Evidencia (captura) |
|---|---|---|---|
| 1 | A 390 px y 1366 px no hay barra de desplazamiento horizontal en ninguna pantalla | PENDIENTE | PENDIENTE |
| 2 | Todo el flujo principal se hace solo con el teclado (Tab, Shift+Tab, Enter, Espacio) y el foco se ve | PENDIENTE | PENDIENTE |
| 3 | Cada campo tiene su etiqueta y los errores están asociados al campo y avisan | PENDIENTE | PENDIENTE |
| 4 | Los botones se desactivan mientras envían (sin clics dobles) | PENDIENTE | PENDIENTE |
| 5 | El texto de IA y de observaciones se ve **como texto** (probar `<b>x</b>` y `<script>`) | PENDIENTE | PENDIENTE |
| 6 | El borrador de IA está marcado como asistencia de IA y el botón Aprobar está aparte | PENDIENTE | PENDIENTE |
| 7 | Los errores 401, 403, 404, 409 y 422 muestran un mensaje comprensible | PENDIENTE | PENDIENTE |
| 8 | Las fechas se muestran en hora de Bogotá | PENDIENTE | PENDIENTE |

## Capturas que debe tomar el usuario

`evidence/tests/capturas/` (no se versiona nada que no sea necesario): inicio de sesión, mis solicitudes, nueva solicitud con error, bandeja con el borrador de IA y tablero, a **390 px** y a **1366 px** (herramientas de desarrollo → modo dispositivo).

## Límites

- Tablas de la interfaz se presentan como tarjetas en todos los anchos (no hay tablas anchas).
- El nombre del solicitante se muestra en la bandeja (campo `requesterName`); no se envía a la IA.
- La lista de SKU del formulario es fija (`KIT-ALIMENTO`, `KIT-HIGIENE`, `KIT-AGUA`): la API no expone el catálogo a un solicitante.
