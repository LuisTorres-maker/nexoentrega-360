# Intervención de IA

ID y fecha UTC: IA-02 / 2026-10-14T04:36:00Z
Autor: PENDIENTE (Luis) — quien ejecutó la sesión; cada autor de SPEC confirma los hallazgos de la suya.
Etapa: Revisión crítica
Herramienta y modelo conocido: Claude Code (modelo informado por la sesión: Claude Sonnet 5.5, id claude-sonnet-5-5)
RF y AC: RF05, RF06, RF07, RF11, RF12 (foco pedido); también RF01, RF02, RF03, RF04, RF08, RF09, RNF01 y RNF06 donde aparecieron hallazgos
Contexto y versiones de archivos: SPEC-001 a SPEC-005 v0.1 (entrada) y v0.2 (salida); `docs/clarifications.md` (Q1 a Q10); `contracts/ai-output.schema.json`; texto literal de RF01 a RF12 y RNF01 a RNF06

## Objetivo

Releer cada SPEC v0.1 contra el texto literal de los requisitos, buscando contradicciones, ambigüedades y criterios de aceptación faltantes,
con atención especial a la reserva, la idempotencia y la validación de salida de la IA. Decidir qué hallazgos son válidos, corregirlos en la
SPEC (versión v0.2) y mandar a `docs/clarifications.md` lo que necesita decisión del cliente.

## Prompt enviado

Resumen fiel: «Relee cada SPEC contra RF01 a RF12 y RNF01 a RNF06. Busca contradicciones entre SPECS, reglas del bloque que no tengan criterio de aceptación,
criterios cuyo resultado esperado no sea observable, ambigüedades del enunciado y huecos en RF05 a RF07 y RF11 a RF12. No cambies reglas del caso.
Lo que dependa del cliente va a clarificaciones.»

Método aplicado por la IA:

1. Verificación mecánica con un script (no versionado): ID de AC únicos, cada AC pertenece a un requisito declarado en su SPEC,
   cada requisito de cada SPEC tiene al menos un AC y los 18 RF y RNF aparecen en alguna SPEC.
2. Relectura cruzada de cada regla del bloque contra los criterios: «¿qué prueba demuestra esta regla?».
3. Comparación del validador de referencia del plan con el esquema cerrado `contracts/ai-output.schema.json` (propiedades `minLength`, `uniqueItems`).
4. Revisión de contradicciones entre SPECS (códigos de error, estados, quién ve qué).

## Salida relevante

Resultado de la verificación mecánica sobre v0.1: 5 SPECS, 122 AC, sin duplicados, sin requisitos sin SPEC y sin AC fuera de los requisitos declarados.
Hallazgos que el script no detecta (de relectura):

| ID | SPEC | Hallazgo | Decisión | Cambio en v0.2 |
|---|---|---|---|---|
| H-01 | SPEC-005 | El esquema cerrado exige `minLength` 1 en `summary` y `reason` y `uniqueItems` en `evidenceFields`, pero el validador de referencia con zod solo comprueba máximos y mínimos de cantidad; una salida con `evidenceFields` repetido pasaría | Válido | Nuevo AC-RF11-07 |
| H-02 | SPEC-001 y SPEC-003 | AC-RF07-08 espera 500 pero ningún código de error cubre errores inesperados: la tabla de códigos HTTP del enunciado no lista el 500 | Válido | Regla y código ERROR_INTERNO en SPEC-001 y SPEC-003; supuesto S4 |
| H-03 | SPEC-003 | La regla de reutilización de la clave pasadas 24 horas estaba solo en el texto y no en el bloque vinculante, aunque AC-RF07-06 depende de ella | Válido | Regla agregada a `businessRules` |
| H-04 | SPEC-002 | El supuesto S1 afirma que el SKU se valida al guardar y al enviar, pero no había criterio para el SKU desactivado entre ambos momentos | Válido | Nuevo AC-RF03-14 |
| H-05 | SPEC-002 | RF04 dice «solo el borrador es editable»; AC-RF04-02 solo probaba ENVIADA | Válido | AC-RF04-02 cubre ENVIADA, RESERVADA, DESPACHADA, ENTREGADA y CANCELADA |
| H-06 | SPEC-005 | El enunciado no dice si el resumen alternativo puede aprobarse | Válido (decisión del equipo, no del cliente) | Regla, supuesto S5 y AC-RF12-10 |
| H-07 | SPEC-004 y SPEC-005 | RF09 pide registrar cada aprobación con recurso, pero no se definía el recurso de un evento de aprobación (no es una solicitud) | Válido | Tipo AI_SUMMARY con el identificador del resumen; AC-RF12-02 lo comprueba |
| H-08 | SPEC-001 | AC-RF02-09 comparaba contra «datos de otra organización» con una prueba de zona de B-001 poco decisiva: la palabra CENTRO puede aparecer por otras causas | Válido | El oráculo compara el cuerpo contra el de un código inexistente (B-999) |
| H-09 | SPEC-001 | AC-RNF01-05 reservaba sin `Idempotency-Key`, de modo que una implementación podría devolver 400 antes que 404 y el criterio no aislaría el orden de controles | Válido | La petición lleva una clave válida |
| H-10 | SPEC-005 | El diseño toma `x-correlation-id` del cliente tal cual y lo escribe en los logs: riesgo de inyección en logs (saltos de línea) | Válido | Regla de sanitización y AC-RNF06-04 |
| H-11 | SPEC-004 | El enunciado no aclara si los roles de organización ven los BORRADOR de otros solicitantes | Requiere decisión del cliente | Pregunta Q10 en `docs/clarifications.md` con supuesto provisional; no cambia AC |
| H-12 | SPEC-005 | El identificador de un resumen no tenía definición pública | Válido | Supuesto S4 |
| H-13 | SPEC-005 | Solicitud sin observaciones: ¿qué recibe el adaptador? | Válido | Caso límite: observaciones nulas |
| H-14 | SPEC-005 | `recommendations` puede ser un arreglo vacío según el esquema; no estaba dicho | Válido | Regla agregada |

Propuestas de la IA que se **descartaron**:

| Propuesta | Motivo del descarte |
|---|---|
| Bloquear la cuenta tras N intentos de login fallidos | Fuera del alcance del enunciado y sin requisito; se declara como supuesto S2 de SPEC-001 |
| Exigir `Idempotency-Key` también en despachar, entregar y cancelar | El enunciado solo lo exige en la reserva; esas transiciones ya son seguras por estado (la repetición responde 409) |
| Filtros por recurso y por fecha en `/audit` | No es requisito de RF09; se evita ampliar el alcance |
| Marcar un resumen como «rechazado» además de aprobado | No lo pide RF12 ni el esquema |

## Decisión humana

PENDIENTE (Luis): Aceptada | Corregida | Descartada, con motivo. Cada autor de PR de SPEC (Luis, Jhoimer, Carlos B) debe indicar aquí
cuáles hallazgos aceptó, cuáles cambió y cuáles descartó con su motivo.

## Verificación

- Tras aplicar los cambios: `python3 scripts/export_specs.py` y `python3 scripts/export_specs.py --check` → `5 SPECS exportadas` y `5 SPECS comprobadas` (código 0).
- Conteo v0.2: 24 + 25 + 28 + 19 + 30 = 126 AC, todos con ID único.
- `python3 scripts/check_trace.py --fase R1` → `Trazabilidad correcta (fase R1): 18 requisitos, 126 AC, 0 filas spec-vs-code` (código 0).
- Lo que **no** se pudo verificar: que los hallazgos H-01 a H-14 cubran todas las ambigüedades. Una segunda persona debe repetir la relectura (la revisión humana
  de cada PR es la verificación independiente).

## Límites

La IA revisó sus propios borradores: el sesgo de confirmación es un riesgo real. Se compensa con la revisión de otra persona en cada PR y con la sesión
adversarial de R7. No se incluyeron claves ni datos reales.
