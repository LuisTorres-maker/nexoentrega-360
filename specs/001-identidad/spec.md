# SPEC-001 Identidad y permisos

Autor: PENDIENTE (Luis). Revisor: PENDIENTE (Carlos B). Fecha UTC: PENDIENTE (Luis). Commit: PENDIENTE (Luis).

## Propósito y actores

Que cada persona entre con su cuenta y solo pueda hacer lo que su rol permite dentro de su organización.
Actores: SOLICITANTE, COORDINADOR, BODEGA y AUDITOR de ORG-A y de ORG-B. Cualquier visitante sin sesión.

## Alcance y exclusiones

Incluye: inicio y cierre de sesión, sesión opaca guardada con hash, consulta de la identidad (`/me`), orden de controles
de cada petición, matriz de permisos por rol, aislamiento entre organizaciones y el formato uniforme de error.
No incluye: recuperación de contraseña, creación masiva de usuarios, proveedores de identidad externos, selector de rol.

## Requisitos de referencia

RF01, RF02 y RNF01 (texto literal del enunciado en `docs/anexos/` y en el plan del equipo).

## Historia de usuario y reglas

HU-01. Como persona de una organización quiero iniciar sesión y que el sistema me deje hacer solo lo de mi rol.

Reglas completas en el bloque estructurado. Resumen del orden de controles de **toda** petición:

| Paso | Control | Resultado si falla |
|---|---|---|
| 1 | Asignar `correlationId` y abrir el log | (siempre ocurre) |
| 2 | Autenticar la sesión | 401 `NO_AUTENTICADO` |
| 3 | Comprobar el rol para la operación | 403 `PROHIBIDO` |
| 4 | Buscar el recurso filtrando por la organización de la sesión (y por dueño si es SOLICITANTE) | 404 `NO_ENCONTRADA` |
| 5 | Validar la entrada (encabezados y cuerpo) | 400 / 422 |
| 6 | Ejecutar, en transacción si cambia datos | 200 / 201 / 409 |

Matriz de permisos (enunciado y decisiones de cobertura):

| Operación | SOLICITANTE | COORDINADOR | BODEGA | AUDITOR |
|---|---|---|---|---|
| Crear, editar y enviar solicitud propia | Sí | No | No | No |
| Cancelar solicitud propia (ENVIADA o RESERVADA) | Sí | No | No | No |
| Consultar solicitudes | Solo las propias | Su organización | Su organización | Su organización |
| Reservar (ENVIADA) | No | Sí | No | No |
| Despachar (RESERVADA) | No | No | Sí | No |
| Entregar (DESPACHADA) | No | Sí | No | No |
| Consultar inventario | No | Sí | Sí | Sí |
| Consultar auditoría | No | Sí | No | Sí |
| Generar y aprobar resúmenes de IA | No | Sí | No | No |

## Entradas, proceso, salidas y casos límite

Ver el bloque estructurado (única fuente vinculante) para entradas, proceso, salidas, reglas, casos límite y criterios de aceptación.

<!-- spec-data:start -->
```json
{
  "id": "SPEC-001",
  "version": "0.2",
  "name": "Identidad y permisos",
  "story": {
    "id": "HU-01",
    "as": "persona de una organización comunitaria con una cuenta sembrada",
    "want": "iniciar sesión y que el sistema me deje hacer solo lo que permite mi rol dentro de mi organización",
    "soThat": "nadie pueda leer ni modificar datos que no le corresponden"
  },
  "requirements": ["RF01", "RF02", "RNF01"],
  "description": "Inicio y cierre de sesión con sesión opaca guardada con hash, autorización por rol en el servidor y aislamiento por organización con respuestas 401, 403 y 404.",
  "inputs": [
    { "field": "email", "type": "cadena", "validation": ["obligatorio", "texto no vacío"] },
    { "field": "password", "type": "cadena", "validation": ["obligatoria", "texto no vacío"] },
    { "field": "Authorization", "type": "encabezado", "validation": ["formato Bearer y token opaco", "la sesión debe existir y no estar vencida ni cerrada"] },
    { "field": "code (ruta)", "type": "identificador de solicitud", "validation": ["debe existir y pertenecer a la organización de la sesión", "para SOLICITANTE debe ser de su propiedad"] },
    { "field": "cuerpo de login", "type": "objeto JSON", "validation": ["solo email y password", "cualquier otro campo, como role u orgId, se rechaza con 422"] }
  ],
  "process": [
    "Asignar un correlationId a la petición y abrir el log estructurado",
    "Login: buscar la cuenta por email y comparar la contraseña con el hash bcrypt; el mismo 401 sirve para cuenta inexistente y clave errónea",
    "Login correcto: generar un token aleatorio de 32 bytes, guardar solo su hash SHA-256 con vencimiento de 8 horas y devolver el token una sola vez",
    "Rutas protegidas: leer el token Bearer, buscar su hash en sesiones vigentes y cargar usuario, rol y organización desde la base",
    "Comprobar que el rol puede ejecutar la operación; si no, responder 403 antes de buscar el recurso",
    "Buscar el recurso filtrando por la organización de la sesión y, si es SOLICITANTE, por dueño; si no aparece, responder 404",
    "Logout: borrar la sesión; el mismo token deja de servir"
  ],
  "outputs": [
    { "condition": "credenciales correctas", "result": "200 con token y datos de la persona (id, rol, organización)" },
    { "condition": "clave incorrecta o cuenta inexistente", "result": "401 CREDENCIALES_INVALIDAS con el mismo mensaje y sin crear sesión" },
    { "condition": "sin token, token inventado, vencido o cerrado", "result": "401 NO_AUTENTICADO" },
    { "condition": "rol sin permiso sobre la operación de un recurso de su organización", "result": "403 PROHIBIDO y nada cambia" },
    { "condition": "recurso inexistente, de otra organización o de otro solicitante", "result": "404 NO_ENCONTRADA con el mismo cuerpo, sin revelar existencia" },
    { "condition": "cuerpo de login incompleto o con campos extra", "result": "422 VALIDACION con el campo inválido y sin sesión" }
  ],
  "businessRules": [
    "La organización y el rol salen siempre de la sesión en base de datos, nunca de encabezados, rutas ni cuerpo",
    "No existe selector de rol: el rol lo determina la cuenta",
    "La contraseña se guarda solo como hash bcrypt (coste 10); el token se guarda solo como hash SHA-256",
    "El orden de controles es autenticar, rol, recurso con organización, validación y ejecución",
    "Un SOLICITANTE solo ve y opera sus solicitudes; las de otro solicitante de su organización responden 404",
    "Ningún cuerpo de error, respuesta ni log incluye contraseñas, hashes, tokens ni datos de otra organización",
    "Formato de error uniforme: error en mayúsculas, mensaje en español, campo o null y correlationId",
    "Un error inesperado responde 500 ERROR_INTERNO con el formato uniforme, sin trazas ni detalles técnicos, y deja los datos sin cambios",
    "Códigos de error: NO_AUTENTICADO, CREDENCIALES_INVALIDAS, PROHIBIDO, NO_ENCONTRADA, VALIDACION, ERROR_INTERNO"
  ],
  "edgeCases": [
    "Esquema de autorización distinto de Bearer o token con espacios",
    "Token válido de una sesión que acaba de cerrarse en otra pestaña",
    "Correo con mayúsculas distintas al guardado",
    "Identificador de solicitud con formato inválido o con caracteres especiales",
    "Petición sin sesión sobre un recurso de otra organización (debe ser 401, no 404)",
    "Solicitante con token válido que intenta reservar una solicitud ajena (debe ser 403, no 404)",
    "Dos sesiones simultáneas de la misma cuenta"
  ],
  "acceptanceCriteria": [
    { "id": "AC-RF01-01", "given": "la cuenta org-a-coordinador@example.test con su contraseña de demostración correcta", "when": "envía POST /auth/login", "then": "responde 200 con un token opaco y el usuario con rol COORDINADOR y organización ORG-A; la tabla de sesiones guarda solo el hash del token y un vencimiento de 8 horas" },
    { "id": "AC-RF01-02", "given": "la cuenta org-a-coordinador@example.test existe", "when": "envía POST /auth/login con una contraseña incorrecta", "then": "responde 401 CREDENCIALES_INVALIDAS y no se crea ninguna fila de sesión" },
    { "id": "AC-RF01-03", "given": "el correo nadie@example.test no existe", "when": "envía POST /auth/login con cualquier contraseña", "then": "responde 401 CREDENCIALES_INVALIDAS con exactamente el mismo cuerpo que AC-RF01-02, sin revelar si la cuenta existe" },
    { "id": "AC-RF01-04", "given": "una sesión abierta del coordinador de ORG-A", "when": "envía POST /auth/logout y luego GET /me con el mismo token", "then": "el logout responde 200, la fila de sesión desaparece y GET /me responde 401 NO_AUTENTICADO" },
    { "id": "AC-RF01-05", "given": "una sesión creada con el reloj en 2030-01-10T14:00:00Z y vencimiento de 8 horas", "when": "con el reloj en 2030-01-10T22:00:01Z se consulta GET /requests con ese token", "then": "responde 401 NO_AUTENTICADO y no devuelve datos" },
    { "id": "AC-RF01-06", "given": "una ruta protegida como GET /requests", "when": "se llama sin encabezado Authorization, con un token inventado y con el esquema Basic en vez de Bearer", "then": "las tres respuestas son 401 NO_AUTENTICADO con el mismo cuerpo" },
    { "id": "AC-RF01-07", "given": "el seed base cargado con 9 cuentas", "when": "se consulta la columna de contraseña de usuarios, las respuestas de login y los logs de una corrida", "then": "cada contraseña está guardada como hash bcrypt y la contraseña en claro no aparece en la base, en ninguna respuesta ni en ningún log" },
    { "id": "AC-RF01-08", "given": "un visitante sin sesión", "when": "envía POST /auth/login sin el campo password, o con password vacío", "then": "responde 422 VALIDACION con campo password y no se crea sesión" },
    { "id": "AC-RF01-09", "given": "la cuenta org-a-solicitante@example.test", "when": "envía POST /auth/login con un campo extra role igual a COORDINADOR", "then": "responde 422 VALIDACION por campo extra, no se crea sesión y el rol no puede elegirse en el login" },
    { "id": "AC-RF02-01", "given": "un coordinador de ORG-A autenticado que conoce el código B-001 de ORG-B", "when": "envía GET /requests/B-001", "then": "responde 404 NO_ENCONTRADA y el cuerpo no contiene la frase Dato exclusivo de ORG-B." },
    { "id": "AC-RF02-02", "given": "un coordinador de ORG-A autenticado y B-001 ENVIADA en ORG-B con inventario de ORG-B en KIT-HIGIENE físico 5 y reservado 0", "when": "envía POST /requests/B-001/reserve con una Idempotency-Key nueva", "then": "responde 404, B-001 sigue ENVIADA, el inventario de ORG-B sigue físico 5 y reservado 0 y no hay evento de auditoría nuevo" },
    { "id": "AC-RF02-03", "given": "un usuario de bodega de ORG-A autenticado y B-001 en ORG-B", "when": "envía POST /requests/B-001/dispatch", "then": "responde 404, el estado de B-001 y el inventario de ORG-B no cambian" },
    { "id": "AC-RF02-04", "given": "el solicitante de ORG-B dueño de B-001 y el solicitante de ORG-A autenticado", "when": "el solicitante de ORG-A envía POST /requests/B-001/cancel", "then": "responde 404 y B-001 sigue ENVIADA" },
    { "id": "AC-RF02-05", "given": "un coordinador de ORG-A con las solicitudes A-001, A-002, A-003 y A-004 y un usuario de ORG-B con B-001", "when": "el coordinador de ORG-A envía GET /requests", "then": "responde 200 con exactamente 4 elementos de ORG-A y ninguno de ORG-B" },
    { "id": "AC-RF02-06", "given": "el inventario sembrado de ORG-A en KIT-ALIMENTO físico 10 y de ORG-B en KIT-ALIMENTO físico 4", "when": "el coordinador de ORG-B envía GET /inventory", "then": "KIT-ALIMENTO aparece con físico 4 y ninguna cantidad de ORG-A" },
    { "id": "AC-RF02-07", "given": "A-001 RESERVADA por el coordinador de ORG-A, que generó un evento de auditoría", "when": "el auditor de ORG-B envía GET /audit", "then": "responde 200 sin ningún evento de ORG-A" },
    { "id": "AC-RF02-08", "given": "A-001 de ORG-A es propiedad de org-a-solicitante@example.test y existe el solicitante org-a-solicitante2@example.test de la misma organización", "when": "org-a-solicitante2 envía GET /requests/A-001 y GET /requests", "then": "el detalle responde 404 y la lista no contiene A-001" },
    { "id": "AC-RF02-09", "given": "una petición cruzada a B-001 hecha por un usuario de ORG-A y otra a un código inexistente como B-999", "when": "se comparan los cuerpos de error, las cabeceras de respuesta y las líneas de log de las dos peticiones", "then": "los cuerpos de error son idénticos salvo el correlationId y ninguno de los tres medios contiene la frase Dato exclusivo de ORG-B. ni las líneas, la zona o el solicitante de B-001" },
    { "id": "AC-RNF01-01", "given": "un auditor de ORG-A autenticado y A-001 ENVIADA", "when": "envía POST /requests/A-001/reserve con una Idempotency-Key nueva", "then": "responde 403 PROHIBIDO, A-001 sigue ENVIADA y el inventario no cambia" },
    { "id": "AC-RNF01-02", "given": "una cuenta de cada uno de los 4 roles de ORG-A y A-001 ENVIADA", "when": "cada rol intenta cada operación que su rol no permite según la matriz de permisos", "then": "todas responden 403 PROHIBIDO, sin cambios de estado, inventario ni auditoría" },
    { "id": "AC-RNF01-03", "given": "el solicitante de ORG-A autenticado", "when": "envía POST /requests con el encabezado X-Org-Id igual a ORG-B y, en otra petición, con un campo orgId igual a ORG-B en el cuerpo", "then": "el encabezado se ignora y la solicitud queda en ORG-A; el campo orgId en el cuerpo responde 422 por campo extra" },
    { "id": "AC-RNF01-04", "given": "usuarios de ORG-A y datos de ORG-B", "when": "se ejecutan dos lecturas cruzadas, GET /requests/B-001 y GET /inventory del coordinador de ORG-A comparado con ORG-B, y dos escrituras cruzadas, reservar y despachar B-001", "then": "las dos lecturas no revelan datos de ORG-B y las dos escrituras responden 404 sin cambiar estado ni inventario de ORG-B" },
    { "id": "AC-RNF01-05", "given": "B-001 pertenece a ORG-B", "when": "se envía reservar B-001 con una Idempotency-Key válida sin sesión, luego con el solicitante de ORG-A y luego con el coordinador de ORG-A", "then": "las respuestas son 401, 403 y 404 en ese orden, probando que se autentica, luego se comprueba el rol y luego se busca el recurso" },
    { "id": "AC-RNF01-06", "given": "una sesión válida del coordinador de ORG-A", "when": "envía GET /me", "then": "la respuesta contiene id, correo, nombre, rol y organización, y no contiene hash de contraseña, hash de sesión ni token" }
  ]
}
```
<!-- spec-data:end -->

## Datos y contrato esperado

| Método | Ruta | Quién | Éxito | Errores |
|---|---|---|---|---|
| POST | `/auth/login` | Cualquiera | 200 `{ token, user: { id, role, orgId } }` | 401, 422 |
| POST | `/auth/logout` | Con sesión | 200 | 401 |
| GET | `/me` | Con sesión | 200 `{ id, email, displayName, role, orgId }` | 401 |

Cuentas sembradas: `org-{a|b}-{solicitante|coordinador|bodega|auditor}@example.test` y `org-a-solicitante2@example.test` (adición del equipo).
La contraseña de demostración es ficticia y se toma de `DEMO_PASSWORD`.

## Supuestos y preguntas

| ID | Supuesto o pregunta | Estado |
|---|---|---|
| S1 | COORDINADOR consulta `/audit` de su organización; BODEGA y SOLICITANTE reciben 403 (decisión de cobertura). | Supuesto del equipo |
| Q6 | Un solicitante que pide la solicitud de otro solicitante de su organización recibe 404. | Abierta, con supuesto provisional |
| S2 | Sin límite de intentos de login ni bloqueo de cuenta (fuera de alcance del enunciado). | Supuesto |
| S3 | El correo se compara sin distinguir mayúsculas. | Supuesto |
| S4 | El 500 ERROR_INTERNO no está en la tabla de códigos del enunciado; se declara como respuesta técnica para errores inesperados. | Supuesto (hallazgo H-02) |
| Q10 | ¿Los roles de organización ven los borradores de otros solicitantes? Supuesto: sí (ver SPEC-004). | Abierta, con supuesto provisional |

## Riesgos y pruebas previstas

| Riesgo | Control | Prueba prevista |
|---|---|---|
| Fuga entre organizaciones | Búsqueda siempre filtrada por organización de la sesión | `tests/integration/security.test.ts` (AC-RF02-xx, AC-RNF01-04) |
| Enumeración de cuentas | Mismo 401 y mismo cuerpo | AC-RF01-02 y AC-RF01-03 |
| Secretos en logs | `redact` en el logger | AC-RF01-07 y AC-RF02-09 |
| Orden de controles invertido | Middlewares en orden fijo | AC-RNF01-05 |

## Cambios de versión

| Versión | Fecha UTC | Cambio |
|---|---|---|
| 0.1 | PENDIENTE (Luis) | Borrador inicial generado con Claude Code. |
| 0.2 | PENDIENTE (Luis) | Revisión crítica IA-02: AC-RF02-09 compara contra un código inexistente (oráculo más fuerte, hallazgo H-08); AC-RNF01-05 envía una Idempotency-Key válida para que el 404 no dependa del 400 (H-09); se declara el error 500 ERROR_INTERNO, ausente en la tabla del enunciado (H-02). |
