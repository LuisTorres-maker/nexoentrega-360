# Revisión de hito

G2 (plan, ADR, diagramas, contrato y datos)
Fecha UTC: PENDIENTE (persona autora y persona revisora, al unir el último PR de la ola 2)
Artefactos y commit: PENDIENTE (SHA de `main` tras unir PR-5 y PR-6). Artefactos: `docs/plan.md`, `docs/adr/0001` a `0004`, `docs/diagramas/*.mmd`, `contracts/openapi.yaml`, `contracts/ai-output.schema.json`, `migrations/001_init.sql`, `migrations/002_security.sql`, `seeds/`, `docs/data-model.md`, `docs/tasks.md`, `tests/integration/db.test.ts`.
Autor: PENDIENTE (Luis, autor del PR que contiene esta acta)
Revisor distinto: PENDIENTE (Carlos B, revisor de ese PR)

## Hallazgos y acciones

Lo completan el autor y el revisor con lo que **de verdad** encontraron. La IA dejó la revisión de coherencia de `docs/plan.md` (seis filas) para que la persona revisora la repita.

| ID | Hallazgo | Acción | Estado |
|---|---|---|---|
| G2-IA-01 | Revisión de coherencia de la IA entre SPECS, esquema y contrato (ver `docs/plan.md`) | Aplicada en el esquema y el contrato | Aplicado por la IA; PENDIENTE (revisor) confirma |
| (revisión humana) | PENDIENTE (revisor) | PENDIENTE | PENDIENTE |

## Criterios satisfechos y abiertos

Estado preparado por la IA sobre el árbol de trabajo del 2026-10-14. Las personas lo confirman sobre el `main` unido y con el CI en verde.

| Criterio | Evidencia disponible | Estado |
|---|---|---|
| Plan con arquitectura, datos, contratos, transacciones, IA, pruebas y revisión de coherencia | `docs/plan.md` | PENDIENTE (revisor lee) |
| Cuatro ADR con alternativas, criterios, consecuencias y verificación | `docs/adr/0001` a `0004` (alternativas comparadas; ADR-0002 con experimento real) | PENDIENTE (revisor lee) |
| Seis diagramas que coinciden con el diseño | `docs/diagramas/*.mmd`; los seis se renderizaron con `@mermaid-js/mermaid-cli` 11.4.2 sin errores | Satisfecho en sintaxis; PENDIENTE coherencia con el código final |
| Contrato HTTP y de IA explícitos y válidos | `npx @redocly/cli lint contracts/openapi.yaml`: «Your API description is valid», 0 advertencias | Satisfecho |
| Contrato: errores almacenados y operaciones reintentables | Descripción de `info` y de `/requests/{code}/reserve` en `openapi.yaml` | Satisfecho (documentado); se prueba en R4 |
| Datos y restricciones imponibles en la base | `tests/integration/db.test.ts`: 29 pruebas en verde sobre PostgreSQL 16.4 | Satisfecho sobre el árbol; PENDIENTE CI en `main` |
| Migraciones y seed idempotentes y auto-registrados | Aplicados dos veces a base local sin error ni duplicados (AC-RNF04-02) | Satisfecho sobre el árbol |
| SQL aplicado en Supabase y verificado con `db:check` | PENDIENTE: lo pega una persona y escribe `SQL EJECUTADO` | Abierto |
| Tareas con dependencias, responsable y estado | `docs/tasks.md` (T-01 a T-37) | PENDIENTE (revisor lee) |
| SPECS aprobadas antes del código | Acta G1 de la ola 1 | PENDIENTE: la frase `G1 APROBADO` se escribió sin evidencia en Git al empezar R2 (ver ENTREGA_02, H) |

## Decisión y justificación

PENDIENTE (aprobada | aprobada con observaciones | rechazada). La completan el autor y el revisor distinto, con fecha real.

## Evidencia

- `npm run verify`: formato, tipos y 37 pruebas en verde (8 de la guardia y 29 de base), 2026-10-14.
- `npx @redocly/cli@2.63.0 lint contracts/openapi.yaml`: válido, 0 advertencias.
- `python3 scripts/export_specs.py --check`: `5 SPECS comprobadas`.
- `npm run seed:check`: `Seeds al dia: coinciden con lo generado.`
- CI de GitHub Actions sobre el SHA de `main`: PENDIENTE.
- `npm run db:check` contra Supabase tras `SQL EJECUTADO`: PENDIENTE.

No marque como aprobado un criterio sin evidencia.
