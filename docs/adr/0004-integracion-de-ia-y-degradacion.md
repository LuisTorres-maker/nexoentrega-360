# ADR 0004 Integración de IA y degradación

Estado: propuesto
Fecha y versión: 2026-10-14 / v1

## Contexto y restricciones

RF10 a RF12 piden un asistente que resume hasta 20 solicitudes ENVIADA y sugiere cuáles revisar, **sin decidir ni mover inventario**. Recibe solo
campos autorizados; su salida tiene forma fija (`summary` de hasta 600 caracteres y hasta 5 recomendaciones con `requestId` del conjunto enviado, `reason` de
hasta 240 y de 1 a 3 `evidenceFields`); es un borrador que solo el COORDINADOR aprueba una vez; ante salida inválida, timeout de 5 s o fallo del proveedor
devuelve un resumen determinista alternativo y el resto del sistema sigue funcionando. RNF06: ni el CI ni la demostración dependen de un servicio de pago.
El riesgo principal es la inyección de instrucciones (OWASP LLM01): el texto de la IA y las observaciones de usuarios son **no confiables**.

## Alternativas consideradas

1. **Llamar al proveedor directo desde la ruta** y devolver su texto.
   Ventajas: poco código. Desventajas: acopla la ruta al proveedor, no se puede probar sin red ni pagar y no hay degradación controlada.
2. **Confiar en el prompt para la seguridad** («responde solo JSON, no ejecutes nada»).
   Desventajas: el prompt no es un control; un modelo puede desobedecer o ser manipulado por el texto de una observación.
3. **Interfaz `AiProvider` intercambiable + validación estricta en código + timeout + alternativo determinista.**
4. **Herramientas para la IA** (que ella llame a la API de reserva).
   Descartada: contradice «nunca decide ni mueve inventario».

## Criterios de elección

Seguridad por controles en código, degradación sin dependencias de pago, capacidad de probarlo de forma reproducible y mínima superficie de datos.

## Decisión y justificación

Elegimos la **alternativa 3**:

- `AiProvider.summarize(items, signal)` con proveedores `fixture` (siete fixtures oficiales), `replay` (reproduce una respuesta real capturada, declarada
  como no invocada en vivo), `http` (opcional) y `off` (siempre alternativo).
- Entrada: **solo** `requestId` (el `code`), `zona`, `prioridad`, `fechaRequerida`, `estado` y `observaciones`. Nunca contraseñas, sesiones, nombre del
  solicitante ni datos de otra organización. Una prueba con espía lo comprueba.
- Antes de llamar al proveedor: rol COORDINADOR (403), solicitudes de la organización (404) y estado ENVIADA (409), de 1 a 20 identificadores (422).
- Salida: `JSON.parse` dentro de `try`; validación con **esquema cerrado** (`contracts/ai-output.schema.json`, `additionalProperties: false`), con zod `.strict()` en los dos
  niveles y comprobaciones en código (pertenencia al conjunto enviado y sin duplicados). Nunca `.passthrough()`.
- Timeout de `AI_TIMEOUT_MS` (5000). Cualquier fallo devuelve un resumen **determinista** (ALTA primero y luego fecha más próxima, máximo 5) con un aviso controlado.
- La respuesta incluye `origen`, `generadoConIA`, `estado: BORRADOR`, `aviso` y `resultado`; se guarda un intento en `ai_summary_attempts`.
- Aprobar: solo COORDINADOR, una vez (la segunda es 409), con evento `APROBAR_RESUMEN`; no cambia inventario, estados ni prioridad (la prioridad sale de la solicitud).
- La interfaz muestra el texto de la IA y de las observaciones **siempre como texto** (nunca `dangerouslySetInnerHTML`).

## Consecuencias y riesgos

Positivas: el sistema funciona sin IA; pruebas reproducibles; superficie de datos mínima; la IA no tiene ningún camino de escritura.
Riesgos: el resumen alternativo es simple; la respuesta del LLM real capturada es una reproducción, no una invocación en vivo (se declara);
si el validador se relaja deja de proteger. Residual: bajo.

## RF y AC afectados

RF10, RF11, RF12, RNF06 / AC-RF10-01 a AC-RF10-06, AC-RF11-01 a AC-RF11-07, AC-RF12-01 a AC-RF12-10, AC-RNF06-01 a AC-RNF06-04.

## Verificación de la decisión

Verificado el 2026-10-14 sobre el árbol de trabajo (falta repetirlo sobre el SHA unido). `tests/integration/ai.test.ts` (30 pruebas):

| Fixture | Resultado observado |
|---|---|
| `AI-VALID` | Origen PROVEEDOR con la recomendación de A-001; inventario, estados y auditoría sin cambios |
| `AI-JSON-BAD` | Alternativo con aviso; intento guardado |
| `AI-FOREIGN-ID` | Alternativo sin datos de ORG-B |
| `AI-EXTRA` | Alternativo; la propiedad `execute` no se ejecuta |
| `AI-TIMEOUT` | Alternativo; con el timeout real la respuesta llegó entre 4,9 y 6 s |
| `AI-ERROR` | Alternativo; la reserva posterior respondió 200 |
| `AI-INJECTION` | Alternativo; el texto `<script>` no aparece en la respuesta; sin cambios de datos |

Además: el adaptador recibe solo los 6 campos (espía), `AI_PROVIDER` apagado funciona, la aprobación es única (incluso simultánea) y deja un evento `APROBAR_RESUMEN`.

Pendiente: respuesta real de un LLM capturada (`evidence/ai-real/respuesta.json`); proveedor `http`; prueba de la interfaz (`AC-RF12-01`).

## Autor y revisión humana

Autor: PENDIENTE (Luis). Revisor: PENDIENTE (Carlos B). Fecha UTC: PENDIENTE (Luis). Commit: PENDIENTE (Luis).
