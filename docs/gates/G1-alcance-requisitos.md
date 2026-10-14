# Revisión de hito

G1 (alcance y requisitos: cinco SPECS aprobadas)
Fecha UTC: PENDIENTE (persona autora y persona revisora, al unir el último PR de la ola 1)
Artefactos y commit: PENDIENTE (SHA del `main` tras unir PR-1 a PR-4). Artefactos: `specs/001-identidad/` a `specs/005-asistente-ia/` (v0.2), `evidence/traceability.csv`, `docs/clarifications.md`, `docs/tasks.md`, `evidence/risk-register.csv`, `evidence/ai-log/01` y `02`.
Autor: PENDIENTE (Carlos B, autor del PR que contiene esta acta)
Revisor distinto: PENDIENTE (Carlos C, revisor de ese PR)

## Hallazgos y acciones

Lo completan el autor y el revisor con lo que **de verdad** encontraron al revisar las SPECS. Hallazgos ya conocidos de la revisión crítica de la IA (IA-02):

| ID | Hallazgo | Acción | Estado |
|---|---|---|---|
| H-01 a H-14 | Catorce hallazgos de la revisión crítica de la IA (ver `evidence/ai-log/02-revision-critica.md`) | Aplicados en las SPECS v0.2, salvo H-11 que pasó a la pregunta Q10 | Aplicados por la IA; PENDIENTE (revisor) confirma |
| (revisión humana) | PENDIENTE (revisor) | PENDIENTE | PENDIENTE |

## Criterios satisfechos y abiertos

Marca "Satisfecho" solo con evidencia. Estado preparado por la IA sobre el árbol de trabajo del 2026-10-14; las personas lo confirman sobre el `main` unido.

| Criterio | Evidencia disponible | Estado |
|---|---|---|
| Cinco historias y cinco SPECS cubren todos los RF y RNF | `python3 scripts/check_trace.py --fase R1`: 18 requisitos de 18 en `requirements` | Satisfecho en el árbol; PENDIENTE confirmar en `main` |
| Entradas, proceso, salidas y AC permiten comprobar efectos persistidos | 126 AC con código HTTP, estado, inventario y eventos observables (mínimos 10, 12, 16, 10, 14 superados) | PENDIENTE (revisores leen cada SPEC) |
| La revisión tiene autor, otra persona revisora, fecha y commit antes del código afectado | Campos de cabecera de cada SPEC en `PENDIENTE (persona)` | Abierto hasta que cada PR se complete |
| JSON generado desde fuente única; comprobación en CI | `export_specs.py` y `--check` con código 0; CI ejecuta el `--check` justo tras el checkout | Satisfecho en el árbol; PENDIENTE ver CI en verde |
| Cada requisito enlaza AC y tarea | `evidence/traceability.csv` (18 filas) y `docs/tasks.md` | Satisfecho; módulo, PR, prueba y evidencia final están `—` a propósito (R3 en adelante) |
| Preguntas al cliente enviadas con fecha real | `docs/clarifications.md` (Q1 a Q10) con fecha en `PENDIENTE (Luis)` | Abierto |
| No hay código de negocio | Solo andamiaje en `apps/api/src/db/safe-test-db.ts` y scripts | Satisfecho |

## Decisión y justificación

PENDIENTE (aprobada | aprobada con observaciones | rechazada). La completan el autor y el revisor distinto, con fecha real, al revisar el `main` unido.

## Evidencia

- `python3 scripts/export_specs.py --check` → `5 SPECS comprobadas` (2026-10-14, árbol de trabajo).
- `python3 scripts/check_trace.py --fase R1` → `Trazabilidad correcta (fase R1): 18 requisitos, 126 AC, 0 filas spec-vs-code`.
- CI de GitHub Actions sobre el SHA de `main`: PENDIENTE.

No marque como aprobado un criterio sin evidencia.
