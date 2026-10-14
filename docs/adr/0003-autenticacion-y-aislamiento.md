# ADR 0003 Autenticación y aislamiento

Estado: propuesto
Fecha y versión: 2026-10-14 / v1

## Contexto y restricciones

RF01 pide inicio y cierre de sesión con cuentas sembradas, justificar sesiones o tokens, sin selector de rol y con contraseñas guardadas con un
hash apropiado. RF02 y RNF01 piden aislar todo por organización (401 sin identidad, 403 acción prohibida sobre recurso propio, 404 inexistente
o de otra organización) también en listados, errores y logs. La identidad de rol y organización no puede venir del navegador.

## Alternativas consideradas

1. **Sesión opaca guardada en la base** (token aleatorio, se guarda su hash SHA-256) con `Authorization: Bearer`.
   Ventajas: se revoca al instante (cierre de sesión, vencimiento); rol y organización se leen de la base en cada petición, así que un cambio
   de rol aplica de inmediato; un robo de la base no revela tokens. Desventajas: una consulta por petición.
2. **JWT firmado** sin estado en el servidor.
   Ventajas: no consulta la base por petición. Desventajas: no se revoca hasta que vence sin una lista adicional; el rol viaja en el token (riesgo
   de rol desactualizado); hay que gestionar claves de firma, que son un secreto más.
3. **Cookie de sesión de servidor** (`HttpOnly`).
   Ventajas: el navegador la protege de scripts. Desventajas: exige proteger contra CSRF y complica las pruebas y la API consumida por herramientas.

## Criterios de elección

Revocación inmediata, que el rol y la organización salgan de una fuente confiable, simplicidad, ausencia de secretos de firma y facilidad
de prueba (401 por vencida o cerrada).

## Decisión y justificación

Elegimos la **alternativa 1**:

- Contraseña con **bcrypt** (coste 10). El mismo 401 y el mismo cuerpo para cuenta inexistente y clave errónea.
- Token de 32 bytes aleatorios; se devuelve una sola vez y se guarda solo `SHA-256(token)` con vencimiento de `SESSION_HOURS` (8 horas).
- Cada petición protegida busca la sesión vigente y carga usuario, rol y organización **de la base**. Nada de eso se toma del cuerpo, de
  encabezados ni de rutas (se ignora `X-Org-Id` y un campo `orgId` en el cuerpo da 422).
- **Orden de controles:** correlationId, autenticar (401), rol (403), búsqueda filtrada por organización y por dueño si es SOLICITANTE (404),
  validar entrada (400 o 422), ejecutar.
- Toda búsqueda de recursos incluye `org_id` de la sesión. Un solicitante que consulta la solicitud de otro solicitante recibe 404 (Q6).
- Los errores, respuestas y logs no incluyen contraseñas, hashes, tokens ni datos de otra organización (el logger redacta `authorization`).
- En el navegador el token se guarda en `sessionStorage`; ninguna decisión de permisos se toma en el cliente.

## Consecuencias y riesgos

Positivas: revocación inmediata, rol siempre actual y sin secreto de firma.
Riesgos: sin límite de intentos de login (fuera de alcance, SPEC-001 S2); un script malicioso en el navegador puede leer `sessionStorage`
(mitigación: el texto de usuarios y de la IA siempre se muestra como texto). Residual: medio-bajo para una demo académica.

## RF y AC afectados

RF01, RF02, RNF01 / AC-RF01-01 a AC-RF01-09, AC-RF02-01 a AC-RF02-09, AC-RNF01-01 a AC-RNF01-06.

## Verificación de la decisión

Verificado el 2026-10-14 sobre el árbol de trabajo (falta repetirlo sobre el SHA unido):

- `tests/integration/auth-requests.test.ts`: login con solo el hash del token y 8 horas (`AC-RF01-01`), mismo 401 para cuenta inexistente y clave errónea (`AC-RF01-02`, `AC-RF01-03`), logout (`AC-RF01-04`),
  vencimiento con reloj inyectado (`AC-RF01-05`), tres formas de 401 con el mismo cuerpo (`AC-RF01-06`) y rechazo de campos extra (`AC-RF01-09`).
- `tests/integration/security-queries.test.ts`: aislamiento en lecturas y escrituras cruzadas con B-001 (`AC-RF02-01` a `AC-RF02-09`, `AC-RNF01-04`), orden 401, 403 y 404 (`AC-RNF01-05`),
  403 para los cuatro roles en cada operación (`AC-RNF01-02`) y `X-Org-Id` ignorado (`AC-RNF01-03`).
- La frase exclusiva de ORG-B no aparece en respuestas ni cabeceras a usuarios de ORG-A.

Pendiente: límite de intentos de login (fuera de alcance); medición de tiempos de respuesta entre cuenta existente e inexistente.

## Autor y revisión humana

Autor: PENDIENTE (Luis). Revisor: PENDIENTE (Carlos B). Fecha UTC: PENDIENTE (Luis). Commit: PENDIENTE (Luis).
