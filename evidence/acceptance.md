# Aceptación de la entrega (BORRADOR)

Estado: **borrador de la ronda R7.** La versión final y la decisión de entregar las completa el equipo en R8, sobre el SHA de `release-examen`.
Ningún dato de esta página es una aprobación humana: los campos de personas están en `PENDIENTE`.

## Tag, SHA y fecha

| Dato | Valor |
|---|---|
| Etiqueta `baseline-v1` | PENDIENTE (Luis) |
| Etiqueta `release-examen` | PENDIENTE (Carlos B) |
| SHA final | PENDIENTE (`git rev-parse release-examen^{commit}`) |
| Fecha UTC | PENDIENTE |

## Equipo e integrantes

Luis (producto y especificaciones; operador de Claude Code), Andrés (backend y datos), Jhoimer (identidad y consultas), Said (interfaz web),
Carlos C (calidad y pruebas), Carlos B (IA y entrega). Repositorio: <https://github.com/LuisTorres-maker/nexoentrega-360>.

## Alcance implementado

| Requisito | Estado (árbol de trabajo, falta SHA) | Evidencia |
|---|---|---|
| RF01 a RF09 (identidad, aislamiento, solicitudes, transiciones, reserva atómica, idempotencia, consultas y auditoría) | `Parcial`: las pruebas pasaron en el árbol de trabajo | `evidence/spec-vs-code.csv` |
| RF10 a RF12 (asistente de IA) | `Parcial`: 7 fixtures y aprobación única; **sin respuesta real de un LLM** | `tests/integration/ai.test.ts`, `evidence/ai-real/` |
| RNF01, RNF02 | `Parcial` | Pruebas de seguridad y concurrencia |
| RNF03 | `Parcial`: p95 41,5 ms, 0 % de errores en esta máquina | `evidence/tests/carga.md` |
| RNF04 | `Parcial`: migraciones y seed dos veces, versiones fijas, Docker Compose; **sin clon limpio en otro computador** | `evidence/tests/clon-limpio.md` |
| RNF05 | `Parcial`: automático 4 de 4; **verificación manual pendiente** | `evidence/tests/rnf05-checklist.md` |
| RNF06 | `Parcial` | `tests/integration/ai.test.ts` |

## Evidencia de aceptación

`npm run verify` (159 pruebas), `npm run e2e` (7 pruebas), `npm run load`, `npm audit`, `gitleaks`, respaldo y restauración. Todo sobre el árbol de trabajo.

## Convergencia (spec, contrato, tareas, código y pruebas)

| Aspecto | Verificación |
|---|---|
| Contrato contra rutas de Express | `tests/unit/contract.test.ts` (19 operaciones) |
| Contrato válido | `npx @redocly/cli lint contracts/openapi.yaml` |
| SPEC contra código | `evidence/spec-vs-code.csv` (126 AC) |
| Trazabilidad | `python3 scripts/check_trace.py --fase R1` (18 requisitos) |
| Tareas | `docs/tasks.md` (T-01 a T-37) |

## Gaps y límites (abiertos)

| Gap | Impacto |
|---|---|
| G1, G2 y G3 sin evidencia en Git (PR sin unir, actas sin completar) | Cadena SPEC → código → prueba no respaldada |
| Pruebas sobre el árbol de trabajo y no sobre un SHA unido | Ningún AC puede ser `Cumple` |
| Respuesta real de un LLM no capturada | RF11: «salida real declarada» pendiente |
| Clon limpio en otro computador | RNF04 sin cronometrar |
| Verificación manual de RNF05 | RNF05 parcial |
| Sesión adversarial no ejecutada | Revisión crítica humana pendiente |
| Sin límite de intentos de login | Fuera de alcance (SPEC-001 S2) |
| Q1 a Q10 sin respuesta del docente | Supuestos provisionales |

## Decisión de entregar

PENDIENTE (equipo).

## Revisión humana

PENDIENTE (persona revisora distinta del autor principal).

## Contribución por integrante

PENDIENTE: se construye en R8 con datos reales de GitHub (`gh pr list`), no con estimaciones.
