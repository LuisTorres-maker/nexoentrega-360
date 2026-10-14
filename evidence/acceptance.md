# Aceptación de la entrega

Estado: **versión de la ronda R8, sobre el SHA `a7a9ba8` (código) y `5b34fa0` (evidencia).** Los campos de personas siguen en `PENDIENTE`: ninguna aprobación humana se inventó.

## Etiquetas, SHA y fecha

| Dato | Valor |
|---|---|
| Etiqueta `baseline-v1` | PENDIENTE (Luis): la etiqueta no existe en el repositorio al 2026-10-14T16:28Z |
| Etiqueta `release-examen` | PENDIENTE (Carlos B) |
| SHA del código evaluado | `a7a9ba8d716a7a75adac4b262afbdcbae012707a` |
| SHA de la evidencia (solo documentos y script de evidencia) | `5b34fa0` |
| SHA final | PENDIENTE (`git rev-parse release-examen^{commit}`) |
| Fecha UTC de las pruebas | 2026-10-14 |

## Equipo e integrantes

Luis (producto y especificaciones; operador de Claude Code), Andrés (backend y datos), Jhoimer (identidad y consultas), Said (interfaz web),
Carlos C (calidad y pruebas), Carlos B (IA y entrega). Repositorio: <https://github.com/LuisTorres-maker/nexoentrega-360>.

## Alcance implementado

| Requisito | Estado sobre `a7a9ba8` | Evidencia |
|---|---|---|
| RF01 a RF09 (identidad, aislamiento, solicitudes, transiciones, reserva atómica, idempotencia, consultas y auditoría) | `Cumple` en la mayoría de sus AC; `Parcial` en AC-RF01-07, AC-RF03-03, AC-RF03-04, AC-RF03-07, AC-RF07-04 y AC-RF09-03 | `evidence/spec-vs-code.csv` |
| RF10 a RF12 (asistente de IA) | `Cumple` en los AC con prueba; **sin respuesta real de un LLM** (`evidence/ai-real/respuesta.json` no existe) | `tests/integration/ai.test.ts`, `evidence/ai-real/` |
| RNF01, RNF02 | `Cumple` | Pruebas de seguridad y concurrencia |
| RNF03 | `Parcial` (AC-RNF03-02); carga: p95 41,5 ms y 0 % de errores en una máquina | `evidence/tests/carga.md` |
| RNF04 | `No cumple` en AC-RNF04-01 (clon limpio sin ejecutar); `Cumple` en AC-RNF04-02 y AC-RNF04-03 | `evidence/tests/clon-limpio.md` |
| RNF05 | Automático 4 de 4; **verificación manual pendiente** | `evidence/tests/rnf05-checklist.md` |
| RNF06 | `Cumple` en los AC con prueba | `tests/integration/ai.test.ts` |

Totales de los 126 AC: **118 `Cumple`, 7 `Parcial`, 1 `No cumple`.**

## Evidencia de aceptación (reales)

| Comprobación | Resultado |
|---|---|
| `npm run verify` (Vitest, base PostgreSQL real) | 159 de 159 |
| `npm run e2e` (Playwright, Chromium) | 7 de 7 |
| `npm run load` (k6, 20 usuarios, 60 s) | CUMPLE (p95 41,5 ms; 0 % de errores) |
| `npm audit --audit-level=high` | 0 vulnerabilidades |
| `gitleaks` | Sin hallazgos |
| CI de GitHub sobre `main` (`evidence/github/runs.json`) | `verificar` y `secretos` en `success` para `2365711`, `212c4d4`, `a7a9ba8` y `5b34fa0`; `e2e` omitido (solo en etiquetas) |
| Contrato OpenAPI | Válido; 19 de 19 rutas coinciden con Express |

## Convergencia (spec, contrato, tareas, código y pruebas)

Ver `evidence/convergence.md`.

## Gaps y límites (abiertos)

| Gap | Impacto |
|---|---|
| Sin PR revisados por otra persona: todo entró a `main` en un commit directo de Luis (R4-H20) | La rúbrica puntúa revisión real; no hay evidencia de ella |
| Actas G1 a G4, bitácora de IA y revisiones con campos `PENDIENTE (persona)` | Falta la evidencia humana |
| Respuesta real de un LLM no capturada | RF11: «salida real declarada» pendiente |
| Clon limpio en otro computador | AC-RNF04-01 `No cumple` |
| Verificación manual de RNF05 y sesión adversarial | RNF05 parcial; revisión crítica humana pendiente |
| Sin límite de intentos de login ni cabeceras HTTP extra | Fuera de alcance (SPEC-001 S2); riesgo aceptado |
| Lista fija de SKU en la interfaz | Si cambia el catálogo hay que cambiar la web |
| Q1 a Q10 sin respuesta del docente | Supuestos provisionales |
| Etiquetas `baseline-v1` y `release-examen` | No creadas |

## Decisión de entregar

PENDIENTE (equipo).

## Revisión humana

PENDIENTE (persona revisora distinta del autor principal).

## Contribución por integrante

Ver `evidence/participation.csv`. Construida solo con datos reales de GitHub (`evidence/github/`): 0 PR y 5 commits en `main`; lo demás figura `PENDIENTE`.
