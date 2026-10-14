# Intervención de IA

ID y fecha UTC: IA-01 / 2026-10-14T04:35:08Z
Autor: PENDIENTE (Luis) — quien ejecutó la sesión de Claude Code y debe confirmar esta bitácora.
Etapa: Especificación
Herramienta y modelo conocido: Claude Code (modelo informado por la sesión: Claude Sonnet 5.5, id claude-sonnet-5-5)
RF y AC: RF01 a RF12 y RNF01 a RNF06; AC-RF01-01 a AC-RNF06-04 (126 criterios en total)
Contexto y versiones de archivos: enunciado y anexos oficiales en `docs/anexos/` (plantilla de SPEC, oráculos de inventario, escenarios del caso, fixtures de IA, esquema de salida de IA); `specs/spec-source-template.md`; `scripts/export_specs.py`; SPEC-001 a SPEC-005 en versión v0.1 (borrador) que luego pasaron a v0.2 (ver IA-02).

## Objetivo

Redactar las cinco SPECS (una por historia HU-01 a HU-05) con entradas, proceso, salidas, reglas, casos límite y criterios de aceptación
en formato Dado/Cuando/Entonces con datos del caso (A-001, A-002, B-001, KIT-ALIMENTO) y resultados observables
(código HTTP, estado guardado, inventario, eventos de auditoría), de modo que cada RF y RNF tenga al menos un criterio.

## Prompt enviado

Resumen fiel del encargo recibido en la sesión (sin secretos):

1. Encargo del usuario: ejecutar la ronda R1 del proyecto NexoEntrega 360 sobre el árbol de trabajo actual, con el plan de publicación por olas
   (la ola 1 reúne R0 y R1) y dejar el plan completo de PR de la ola 1 al cerrar.
2. Instrucciones permanentes con las que trabaja la IA en este repositorio (el archivo que las contiene no se versiona, por eso se resumen aquí):
   - **Alcance:** solo RF01 a RF12 y RNF01 a RNF06; sin pagos, mapas, notificaciones ni microservicios.
   - **SDD primero:** no se escribe código de negocio hasta que las SPECS estén aprobadas por otra persona; antes solo andamiaje.
   - **No inventar evidencia:** resultados, tiempos, SHA, números de PR y fechas salen de ejecuciones reales; lo no ejecutado se escribe `NO EJECUTADO`.
   - **Git de solo lectura:** la IA no hace `add`, `commit`, `push`, `merge`, `checkout` ni etiquetas; las personas del equipo publican con su propia cuenta.
   - **Trabajo por rondas:** cada ronda termina con un archivo de entrega y la IA se detiene hasta recibir la frase de confirmación.
   - **Secretos:** nunca se escriben ni se imprimen claves; la base de Supabase solo se consulta con `npm run db:check` y nunca se ejecutan migraciones desde la IA.
   - **Campos humanos:** autor, revisor, fecha y decisión de actas, bitácora y SPEC se dejan en `PENDIENTE (persona)`.
3. Datos de partida que se entregaron a la IA: plantilla de SPEC con un único bloque JSON, lista de requisitos RF/RNF literales, matriz de roles,
   tabla de códigos HTTP, oráculos de inventario, escenario sembrado (A-001, A-002, B-001), reglas del exportador (sin corchetes en `id`, `version`, `name`,
   `story` ni en `id/given/when/then` de los AC).

## Salida relevante

- `specs/001-identidad/spec.md` (24 AC), `specs/002-solicitudes/spec.md` (25), `specs/003-inventario/spec.md` (28), `specs/004-consultas-auditoria/spec.md` (19)
  y `specs/005-asistente-ia/spec.md` (30), cada una con su `spec.json` exportado.
- En la primera pasada (v0.1) la IA produjo 122 AC; tras la revisión crítica (IA-02) quedaron 126.
- Datos sembrados adicionales propuestos como supuesto del equipo: A-003 (BORRADOR), A-004 (CANCELADA), KIT-INACTIVO y org-a-solicitante2.

## Decisión humana

PENDIENTE (Luis): Aceptada | Corregida | Descartada, con motivo. Cada autor de PR (Luis para SPEC-001 a SPEC-003, Jhoimer para SPEC-004,
Carlos B para SPEC-005) debe anotar aquí qué cambió al leer su SPEC.

## Verificación

- `python3 scripts/export_specs.py` → `5 SPECS exportadas` y `python3 scripts/export_specs.py --check` → `5 SPECS comprobadas` (código 0), sobre el árbol de trabajo
  del 2026-10-14.
- Script de conteo (no versionado): SPEC-001 24, SPEC-002 25, SPEC-003 28, SPEC-004 19, SPEC-005 30; total 126 con 126 identificadores únicos y ningún AC con corchetes.
  Mínimos exigidos: 10, 12, 16, 10 y 14.
- Cada RF y RNF aparece en el arreglo `requirements` de al menos una SPEC (18 de 18).
- Pendiente de la persona: leer cada SPEC contra el enunciado y comprobar los oráculos a mano.

## Límites

La IA no tuvo respuesta del docente a las preguntas Q1 a Q10: las decisiones provisionales están marcadas como supuestos.
Ninguna prueba se ha ejecutado todavía contra código (no existe código de negocio). Los AC de rendimiento (RNF03) y de clon limpio (RNF04)
dependen del hardware y del entorno reales. No se incluyeron claves ni datos reales; las cuentas y las contraseñas son ficticias.
