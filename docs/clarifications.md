# Preguntas y decisiones del cliente

Versión: v0.1 (borrador de la ronda R0)
Responsable de enviar las preguntas al docente: Luis.

Una respuesta de IA es una propuesta; no es decisión del cliente. Mientras el docente no responda,
cada pregunta tiene un **supuesto provisional** que el equipo sigue. Si el docente responde distinto,
se actualiza la fila, la SPEC afectada y su historial de cambios.

Los campos `Fecha` y `Respuesta y autoridad` los completa una persona con datos reales
(fecha y hora de envío, y la respuesta con quién la dio). No se rellenan por adelantado.

| ID | Fecha | RF o RNF | Pregunta | Riesgo | Propuesta | Respuesta y autoridad | Supuesto provisional | Impacto | Estado |
|---|---|---|---|---|---|---|---|---|---|
| Q1 | PENDIENTE (Luis) | RF03, RF08 | ¿Cuáles son las zonas permitidas y qué pasa con una zona desconocida? | Datos inconsistentes en filtros y pruebas | Zonas: NORTE, CENTRO, SUR, ORIENTE, OCCIDENTE. Zona desconocida: 422 | PENDIENTE (Luis) | Se usan esas cinco zonas y una zona desconocida responde 422 | Enum en la base (`CHECK`), validación zod, filtros del listado y AC de SPEC-002 y SPEC-004 | Abierta |
| Q2 | PENDIENTE (Luis) | RF03, RF09 | ¿Qué formato de fecha usamos y cómo se muestra la hora? | Errores de zona horaria en la fecha requerida | API en ISO 8601 UTC; la interfaz muestra hora de Bogotá (UTC-5) | PENDIENTE (Luis) | Se guarda en UTC (`timestamptz`) y la interfaz convierte a UTC-5 | Columnas `timestamptz`, validación de fecha al enviar, pantallas de R6 | Abierta |
| Q3 | PENDIENTE (Luis) | RF03, RF10 | ¿Cuál es el máximo de caracteres de las observaciones? | Entradas enormes hacia la IA | 500 caracteres; más: 422 | PENDIENTE (Luis) | Máximo 500 caracteres; 501 responde 422 | `CHECK` en la base, validación zod, límite de entrada al asistente | Abierta |
| Q4 | PENDIENTE (Luis) | RF10, RF12 | ¿Se guardan los intentos de resumen de IA? | Sin evidencia de qué se aprobó | Sí: tabla `ai_summary_attempts` con resultado y origen (IA o alternativo) | PENDIENTE (Luis) | Se guarda cada intento con origen, resultado e identificadores | Tabla `ai_summary_attempts`, auditoría de la aprobación, SPEC-005 | Abierta |
| Q5 | PENDIENTE (Luis) | RF07 | ¿Qué errores se guardan para idempotencia y cuáles se pueden reintentar? | Reintentos que duplican o respuestas viejas | Se guardan solo las respuestas exitosas por 24 h. Los errores 4xx y 5xx no se guardan y se pueden reintentar con la misma clave | PENDIENTE (Luis) | Solo se guarda el éxito durante 24 horas; los errores no se guardan y se reintentan | Tabla `idempotency_keys`, contrato OpenAPI, SPEC-003, pruebas de idempotencia | Abierta |
| Q6 | PENDIENTE (Luis) | RF02, RF08 | Un solicitante que consulta la solicitud de otro solicitante de su misma organización, ¿recibe 403 o 404? | Revelar la existencia de datos ajenos | 404 (solo ve las suyas) | PENDIENTE (Luis) | 404 para la solicitud de otro solicitante de la misma organización | Búsqueda filtrada por organización y por dueño; AC de SPEC-001 y SPEC-004 | Abierta |
| Q7 | PENDIENTE (Luis) | RF08 | Si piden más de 100 elementos por página, ¿se recorta o se rechaza? | Respuestas pesadas o ambiguas | 422 si `pageSize` > 100 | PENDIENTE (Luis) | `pageSize` mayor que 100 responde 422 | Validación de consultas, contrato OpenAPI, AC de SPEC-004 | Abierta |
| Q8 | PENDIENTE (Luis) | RF03, RF05 | ¿Qué pasa si una línea usa un SKU inactivo, inexistente o sin inventario cargado en la organización? | Reservas con datos rotos | SKU inactivo o inexistente: 422. SKU sin fila de inventario: se trata como 0 y la reserva da 409 | PENDIENTE (Luis) | Inactivo o inexistente responde 422; sin fila de inventario cuenta como 0 y la reserva responde 409 | Validación al enviar, servicio de reserva, AC de SPEC-002 y SPEC-003 | Abierta |
| Q9 | PENDIENTE (Luis) | RF12 | ¿Se puede aprobar varias veces el mismo resumen de IA? | Auditoría duplicada | No: una aprobación por intento; la segunda da 409 | PENDIENTE (Luis) | Una sola aprobación por intento; la segunda responde 409 | Servicio de aprobación, auditoría, AC de SPEC-005 | Abierta |

## Decisiones de cobertura del enunciado (no son preguntas al docente)

Estas decisiones completan huecos del enunciado y se registrarán como supuestos en la SPEC correspondiente (R1).

| Tema | Decisión del equipo | SPEC |
|---|---|---|
| Quién consulta `/audit` | COORDINADOR y AUDITOR de su organización. BODEGA y SOLICITANTE reciben 403. | SPEC-004 |
| Quién ve solicitudes de otro solicitante | Nadie con rol SOLICITANTE; los demás roles ven las de su organización. | SPEC-001, SPEC-004 |
