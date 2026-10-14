# Revisión de convergencia

Fecha: 2026-10-14. SHA del código: `a7a9ba8`; evidencia: `5b34fa0`. Revisor humano distinto del autor principal: **PENDIENTE (persona revisora)**.

Contrasta lo que dicen la SPEC, el contrato, las tareas, el código y las pruebas.

## Contrastes automáticos (ejecutados)

| Contraste | Cómo se comprueba | Resultado |
|---|---|---|
| SPEC (fuente) ↔ SPEC (JSON) | `python3 scripts/export_specs.py --check` | 5 SPECS coinciden |
| SPEC ↔ trazabilidad ↔ pruebas | `python3 scripts/check_trace.py --fase R1` | 18 requisitos, 126 AC y 126 filas de SPEC contra código |
| Contrato ↔ rutas de Express | `tests/unit/contract.test.ts` | 19 de 19 operaciones |
| Contrato válido | `npx @redocly/cli@2.63.0 lint contracts/openapi.yaml` | Válido |
| Esquema SQL ↔ seeds | `npm run seed:check` | Al día |
| Pruebas con base real | `npm run verify` | 159 de 159 |
| Recorrido por interfaz | `npm run e2e` | 7 de 7 |
| CI en GitHub | `evidence/github/runs.json` | `verificar` y `secretos` en `success` para el SHA `5b34fa0` |

## Gaps cerrados

| Gap | Cómo se cerró |
|---|---|
| Ningún AC con SHA evaluado | Pruebas ejecutadas sobre `a7a9ba8`: 118 `Cumple` |
| Lista de solicitudes truncada a 50 y 100 filas sin forma de ver el resto | Paginación (20 por página) en la interfaz |
| `seed:check` y `lint` fallaban con CRLF en Windows | `.gitattributes`, `endOfLine: auto` y comparación tolerante |
| Inventario del coordinador ilegible | Una fila por valor |
| `trace:check` no exigía una corrección para un `Cumple` | El generador escribe «No aplica (sin defecto)» |

## Gaps abiertos

| Gap | Responsable | Impacto |
|---|---|---|
| 7 AC `Parcial` (AC-RF01-07, AC-RF03-03, AC-RF03-04, AC-RF03-07, AC-RF07-04, AC-RF09-03, AC-RNF03-02) | Carlos C | Parte del criterio sin prueba automática (interfaz, API o carga) |
| AC-RNF04-01 `No cumple`: clon limpio sin ejecutar | Carlos B | RNF04 sin cronometrar |
| Respuesta real de LLM | Carlos B | RF11 pendiente |
| RNF05 manual y sesión adversarial | Said, Carlos C | Evidencia humana |
| Actas G1 a G4, bitácora y revisiones en `PENDIENTE` | Cada persona | Falta firma humana |
| Sin PR revisados | Luis | Participación y revisión sin evidencia en GitHub |
| Etiquetas | Luis, Carlos B | `baseline-v1` y `release-examen` sin crear |

## Observaciones de coherencia

- La columna `PR` de `spec-vs-code.csv` dice «plan abandonado: commit directo a main» porque los 11 PR no se publicaron (R4-H20).
- Las ENTREGAS 00 a 04 y la guía de PR describen el plan de 11 PR; quedan como histórico y no describen el estado actual.
