# Intervención de IA

ID y fecha UTC: IA-07 / 2026-10-14T06:05:00Z
Autor: PENDIENTE (Carlos B) — quien publica PR-9.
Etapa: Implementación (integración de IA del producto)
Herramienta y modelo conocido: Claude Code (modelo informado por la sesión: Claude Sonnet 5.5, id claude-sonnet-5-5)
RF y AC: RF10, RF11, RF12, RNF06 / AC-RF10-01 a AC-RF10-06, AC-RF11-01 a AC-RF11-07, AC-RF12-02 a AC-RF12-10, AC-RNF06-01 a AC-RNF06-04
Contexto y versiones de archivos: SPEC-005 v0.2, `docs/adr/0004-integracion-de-ia-y-degradacion.md` v1, `contracts/ai-output.schema.json` (idéntico al anexo), `tests/fixtures/ai-provider-fixtures.json` (copia del anexo)

## Objetivo

Integrar el asistente de IA del producto con controles: entrada mínima, salida validada, timeout, resumen alternativo, aprobación única y operación sin proveedor de pago.

## Prompt enviado

Resumen del encargo: implementar `AiProvider`, `validarSalida` (esquema cerrado en dos niveles y reglas en código), servicio con timeout de 5 s y alternativo determinista, los proveedores
`fixture`, `replay` y modo apagado, las rutas `POST /ai/summaries` y `POST /ai/summaries/{id}/approve`, y pruebas con los 7 fixtures oficiales y con una observación maliciosa.
Restricciones: la IA no recibe herramientas ni escribe datos; su salida es texto no confiable; los campos enviados son solo seis.

## Salida relevante

- `apps/api/src/ai/ai.ts` (interfaz, validador, servicio, proveedores) y `apps/api/src/services/ai.ts` (rutas y aprobación con evento `APROBAR_RESUMEN`).
- 30 pruebas en `tests/integration/ai.test.ts`: los 7 fixtures (`AI-VALID`, `AI-JSON-BAD`, `AI-FOREIGN-ID`, `AI-EXTRA`, `AI-TIMEOUT`, `AI-ERROR`, `AI-INJECTION`), el espía de campos, el timeout real de 5 s
  (respuesta entre 4,9 y 6 s), la aprobación única (incluida la simultánea) y el modo apagado.

**Origen del LLM integrado (declaración honesta):**

- La aplicación **no invoca un LLM en vivo**. Los proveedores disponibles son `fixture` (siete respuestas oficiales), `replay` (reproduce una respuesta real capturada) y modo apagado.
- La respuesta real capturada (`evidence/ai-real/respuesta.json`) **no existe todavía**: la debe obtener una persona con un LLM real y guardarla sin retocar (R5-05). Hasta entonces el proveedor `replay`
  falla de forma controlada y la API devuelve el resumen alternativo.
- No se implementó `HttpProvider`.

## Decisión humana

PENDIENTE (Carlos B): Aceptada | Corregida | Descartada, con motivo.

## Verificación

`npm run verify` el 2026-10-14: 159 pruebas pasaron, 0 fallaron; 30 son de IA. El timeout real de 5 s se midió dentro de la prueba (entre 4,9 y 6 s).
No ejecutado: invocación de un proveedor real, `evidence/ai-real/` y la prueba de la interfaz (AC-RF12-01).

## Límites

El resumen alternativo es intencionalmente simple. Un proveedor `http` queda fuera. La prueba de inyección usa el texto oficial `untrusted-observation.txt` y el fixture `AI-INJECTION`; no se probaron otras familias de ataques.
Sin claves ni datos reales.
