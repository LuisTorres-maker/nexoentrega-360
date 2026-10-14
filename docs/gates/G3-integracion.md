# Revisión de hito

G3 (integración revisada)
Fecha UTC: PENDIENTE (persona autora y persona revisora, al unir el último PR de la ola 3)
Artefactos y commit: PENDIENTE (SHA de `main` tras unir PR-7 y PR-8; el mismo `main` de la etiqueta `baseline-v1`). Artefactos: `apps/api/src/`, `tests/`, `evidence/spec-vs-code.csv`, `evidence/traceability.csv`, `evidence/baseline-v1.md`, `evidence/ai-log/04`, `05` y `07`.
Autor: PENDIENTE (Jhoimer, autor del PR que contiene esta acta)
Revisor distinto: PENDIENTE (Andrés, revisor de ese PR)

## Hallazgos y acciones

Lo completan el autor y el revisor con lo que **de verdad** encontraron. La IA registró estos hechos al escribir el código:

| ID | Hallazgo | Acción | Estado |
|---|---|---|---|
| G3-IA-01 | Cuatro fallos del propio proceso (import de un `.d.ts`, prueba con sesión vencida, reglas de ESLint, BOM en regex), ninguno del producto | Corregidos y registrados en IA-04 | Cerrado |
| G3-IA-02 | Las pruebas corrieron sobre el árbol de trabajo, no sobre un SHA | Repetir `npm run verify` y `scripts/gen_evidencia.py --sha` sobre `main` unido | Abierto |
| (revisión humana) | PENDIENTE (revisor) | PENDIENTE | PENDIENTE |

## Criterios satisfechos y abiertos

| Criterio | Evidencia disponible | Estado |
|---|---|---|
| Recorrido completo con roles, inventario y auditoría | `evidence/baseline-v1.md`; `tests/integration/reserve.test.ts` | Satisfecho en el árbol; PENDIENTE confirmar sobre `main` |
| Oráculos de inventario (10/7/3, 10/0/10, 3/0/3) | `AC-RF05-01`, `AC-RF06-01`, `AC-RF06-02` | Satisfecho en el árbol |
| Concurrencia (20 repeticiones) | `tests/integration/concurrency.test.ts` | Satisfecho en el árbol |
| Aislamiento: 2 lecturas y 2 escrituras cruzadas denegadas | `AC-RNF01-04`, `AC-RF02-01` a `AC-RF02-04` | Satisfecho en el árbol |
| Idempotencia completa (RF07) | `AC-RF07-01` a `AC-RF07-09` | Satisfecho en el árbol |
| Contrato coincide con las rutas | `tests/unit/contract.test.ts` | Satisfecho |
| Los 7 fixtures de IA, inyección y aprobación única | `tests/integration/ai.test.ts` | Satisfecho en el árbol; respuesta real capturada PENDIENTE |
| CI en verde sobre el SHA unido | PENDIENTE | Abierto |
| Interfaz, carga, clon limpio | No existen todavía | Abierto (R6 y R7) |
| SPEC contra código con SHA | `evidence/spec-vs-code.csv` en `Parcial` | Abierto |

## Decisión y justificación

PENDIENTE (aprobada | aprobada con observaciones | rechazada). La completan el autor y el revisor distinto, con fecha real.

## Evidencia

- `npm run verify` (2026-10-14): 159 pruebas pasaron, 0 fallaron.
- `python3 scripts/check_trace.py --fase R1`: 18 requisitos, 126 AC, 126 filas spec-vs-code.
- CI de GitHub Actions sobre el SHA de `main`: PENDIENTE.

No marque como aprobado un criterio sin evidencia.
