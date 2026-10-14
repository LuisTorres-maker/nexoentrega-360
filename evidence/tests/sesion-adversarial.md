# Sesión adversarial (45 minutos, dos personas)

Estado: **NO EJECUTADA.** La preparó la IA; la ejecutan **dos personas** y llenan las columnas «Observado», «Evidencia» y «Defecto».
La IA no completa esas columnas (R-07 y R-08).

| Dato | Valor |
|---|---|
| Fecha y hora UTC | PENDIENTE (persona 1 y persona 2) |
| Personas | PENDIENTE (dos integrantes distintos) |
| Commit evaluado | PENDIENTE (`git rev-parse HEAD`) |
| Entorno | PENDIENTE (`npm run up`, base de Docker) |

Cómo: con la API en `http://localhost:3000` y un cliente (por ejemplo `curl` o la interfaz en `http://localhost:8080`). El token sale de `POST /auth/login`.
Si hay un defecto: hallazgo, corrección y nueva verificación (y fila en `evidence/defects.md`). Si no hay: qué se comprobó y con qué evidencia se aceptó.

| # | Intento | Esperado | Observado | Evidencia | Defecto (sí/no) |
|---|---|---|---|---|---|
| 1 | Enviar una línea con cantidad 0, 501, -3 y 2.5 | 422 con `campo` `lines.0.quantity`; no se crea solicitud | PENDIENTE | PENDIENTE | PENDIENTE |
| 2 | Enviar una solicitud con 11 líneas, con SKU repetido o con `KIT-INACTIVO` | 422; no se crea solicitud | PENDIENTE | PENDIENTE | PENDIENTE |
| 3 | Enviar con fecha requerida anterior a este momento | 422 con `campo` `requiredDate`; sigue BORRADOR | PENDIENTE | PENDIENTE | PENDIENTE |
| 4 | Editar una solicitud que ya está ENVIADA | 409; datos intactos | PENDIENTE | PENDIENTE | PENDIENTE |
| 5 | Reservar un BORRADOR, o una ENVIADA dos veces con claves distintas | 409; reservado sin cambios | PENDIENTE | PENDIENTE | PENDIENTE |
| 6 | Reusar una `Idempotency-Key` con otra solicitud | 409 `LLAVE_CON_OTRO_CONTENIDO` | PENDIENTE | PENDIENTE | PENDIENTE |
| 7 | Despachar una ENVIADA (sin reservar) o entregar una RESERVADA | 409; sin cambios | PENDIENTE | PENDIENTE | PENDIENTE |
| 8 | Usar el código de una solicitud de la otra organización (leer, reservar, despachar, cancelar y resumir con IA) | 404; sin cambios; sin filtrar datos | PENDIENTE | PENDIENTE | PENDIENTE |
| 9 | Llamar rutas sin sesión, con sesión vencida y con sesión cerrada (logout) | 401 | PENDIENTE | PENDIENTE | PENDIENTE |
| 10 | Probar cada rol en operaciones que no le corresponden (auditor reservando, bodega reservando, solicitante despachando) | 403; sin cambios | PENDIENTE | PENDIENTE | PENDIENTE |
| 11 | Pedir `pageSize=1000` y filtros con valores inválidos | 422 | PENDIENTE | PENDIENTE | PENDIENTE |
| 12 | Poner `<script>` y frases «ignora las reglas» en observaciones; ver si se muestran como texto y si la IA cambia algo | Texto escapado; sin cambios de inventario, estados ni auditoría | PENDIENTE | PENDIENTE | PENDIENTE |
| 13 | Apagar la IA (`AI_PROVIDER=off`) y comprobar que el resto sigue funcionando | Resumen alternativo; listados y reservas normales | PENDIENTE | PENDIENTE | PENDIENTE |
| 14 | Buscar secretos en el historial de Git y en los logs | Ninguno | PENDIENTE | PENDIENTE | PENDIENTE |
| 15 | Cerrar la sesión en una pestaña y usar el token en otra | 401 | PENDIENTE | PENDIENTE | PENDIENTE |
| 16 | Dos reservas de A-001 y A-002 desde dos pestañas a la vez | Una 200 y una 409; 10/7/3 | PENDIENTE | PENDIENTE | PENDIENTE |

## Conclusión

PENDIENTE (las dos personas): defectos encontrados y decisión.
