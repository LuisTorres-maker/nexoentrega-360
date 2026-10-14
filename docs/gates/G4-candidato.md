# Revisión de hito

G4 (candidato de entrega)
Fecha UTC: PENDIENTE (persona autora y persona revisora, al unir el último PR de la ola 4)
Artefactos y commit: PENDIENTE (SHA de `main` tras unir PR-9, PR-10 y PR-11; el mismo SHA de las corridas de CI y E2E). Artefactos: `apps/`, `tests/`, `docker-compose.yml`, `docs/runbook.md`, `loadtest/`, `evidence/`.
Autor: PENDIENTE (Carlos C, autor del PR que contiene esta acta)
Revisor distinto: PENDIENTE (Said, revisor de ese PR)

## Hallazgos y acciones

| ID | Hallazgo | Acción | Estado |
|---|---|---|---|
| G4-IA-01 | `gitleaks` halló el token de sesión de k6 en `evidence/tests/k6-resumen.json` | Corregido (D-01) | Cerrado |
| G4-IA-02 | Fallo intermitente del pool `forks` de Vitest en Windows | `pool: threads` (D-02) | Cerrado, con vigilancia |
| G4-IA-03 | Las pruebas, el E2E y la carga corrieron sobre el árbol de trabajo, no sobre un SHA | Repetir todo sobre `main` unido y regenerar `spec-vs-code.csv` con `--sha` | Abierto |
| (revisión humana) | PENDIENTE (revisor) | PENDIENTE | PENDIENTE |

## Criterios satisfechos y abiertos

| Criterio | Evidencia disponible | Estado |
|---|---|---|
| Flujo completo por interfaz y API | `tests/e2e/flujo.spec.ts` (7 pruebas) y `reserve.test.ts` | Satisfecho en el árbol; PENDIENTE sobre `main` |
| Pruebas de dominio, API, base real, concurrencia, seguridad, IA, E2E y regresión | 159 pruebas de Vitest y 7 de Playwright | Satisfecho en el árbol |
| CI del SHA final | PENDIENTE (no hay PR unidos) | **Abierto** |
| Carga: p95 ≤ 700 ms y errores < 1 % (20 usuarios, 60 s, 2.000 solicitudes) | `evidence/tests/carga.md`: p95 41,5 ms, 0 % de errores | Satisfecho en esta máquina |
| Clon limpio ≤ 15 min | `evidence/tests/clon-limpio.md`: NO EJECUTADO en otro computador | **Abierto** |
| Runbook con arranque, comprobaciones, IA apagada, reversión y respaldo | `docs/runbook.md`; respaldo y restauración probados (`evidence/tests/respaldo.md`) | Satisfecho; PENDIENTE ensayo en otro computador |
| RNF05 verificado manualmente a 390 y 1366 px | Parte automática pasó; parte manual en `PENDIENTE` | **Abierto** |
| Sesión adversarial de dos personas | `evidence/tests/sesion-adversarial.md`: NO EJECUTADA | **Abierto** |
| Respuesta real de un LLM capturada | `evidence/ai-real/`: sin `respuesta.json` | **Abierto** |
| Auditoría de dependencias y secretos | `npm audit`: 0 vulnerabilidades; `gitleaks`: sin hallazgos tras D-01 | Satisfecho en el árbol |
| Actas G1, G2 y G3 completas con datos reales | PENDIENTE | **Abierto** |

## Decisión y justificación

PENDIENTE (aprobada | aprobada con observaciones | rechazada). La completan el autor y el revisor distinto, con fecha real.

## Evidencia

- `npm run verify` (2026-10-14): 159 pruebas pasaron.
- `npm run e2e` (2026-10-14T12:37Z): 7 de 7 pasaron.
- `npm run load` (2026-10-14T12:33Z): p95 41,5 ms; 0 % de errores; 44.859 peticiones.
- CI de GitHub Actions sobre el SHA de `main`: PENDIENTE.

No marque como aprobado un criterio sin evidencia.
