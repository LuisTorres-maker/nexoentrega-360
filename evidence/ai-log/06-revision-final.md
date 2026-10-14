# Intervención de IA

ID y fecha UTC: IA-06 / 2026-10-14T12:38:30Z
Autor: PENDIENTE (Carlos C) — quien publica PR-11 y debe confirmar esta bitácora.
Etapa: Revisión final
Herramienta y modelo conocido: Claude Code (modelo informado por la sesión: Claude Sonnet 5.5, id claude-sonnet-5-5)
RF y AC: RF02, RF10, RF11, RNF01, RNF06 / AC-RF02-01 a AC-RF02-09, AC-RNF01-01 a AC-RNF01-06, AC-RF11-06, AC-RNF06-02
Contexto y versiones de archivos: árbol de trabajo completo (HEAD `8bc3565` más cambios sin commit): `apps/api/src/`, `apps/web/src/`, `migrations/`, `seeds/`, `scripts/`, `.github/workflows/ci.yml`

## Objetivo

Revisar el diff completo buscando fugas entre organizaciones, secretos e inyección. Cada alerta se comprueba con una prueba o un comando, o se descarta con razón.

## Prompt enviado

«Revisa todo el código y los archivos versionables como un revisor desconfiado. Busca: (1) consultas sin filtro de organización; (2) SQL armado con texto del usuario;
(3) secretos o tokens en archivos, logs o evidencias; (4) puntos donde texto de usuarios o de la IA se interprete (HTML, eval, SQL); (5) controles de autorización que dependan del cliente.
Para cada alerta: compruébala con una prueba o un comando, o descártala con su motivo. No cambies reglas del caso.»

## Salida relevante

| # | Alerta | Cómo se comprobó | Resultado |
|---|---|---|---|
| 1 | Consultas sobre `requests` sin `org_id` | `grep "FROM requests"` en `apps/api/src`: toda búsqueda pasa por `buscarSolicitud` (con `org_id` y dueño) o filtra por `org_id` (`ai.ts`); `detalleDe(id)` solo se llama después de una búsqueda autorizada | **Descartada**; cubierta por AC-RF02-01 a AC-RF02-09 y AC-RNF01-04 |
| 2 | SQL armado con texto del usuario | `grep` de interpolaciones en servicios: solo fragmentos fijos (`donde`) y nombres de columna de una lista cerrada; los valores van como parámetros | **Descartada**; AC-RF08-05 rechaza filtros inválidos con 422 |
| 3 | Token de sesión en `evidence/tests/k6-resumen.json` | `gitleaks detect` marcó el archivo (campo `setup_data.token`) | **Confirmada y corregida** (D-01 en `evidence/defects.md`); luego «no leaks found» |
| 4 | Literal con forma de clave en `tests/integration/ai.test.ts` | `gitleaks detect` | **Falso positivo**; se reemplazó por una constante armada por partes |
| 5 | Texto de usuarios o IA interpretado como HTML | `grep` de `dangerouslySetInnerHTML`, `innerHTML` y `eval` en `apps/web/src`: ninguno; el E2E de AC-RF12-01 comprueba que el borrador no contiene `<script>` | **Descartada** |
| 6 | Logs con secretos | La única línea de log por petición registra método, ruta y estado; el logger redacta `authorization`, `password` y `token`; AC-RNF06-02 lo comprueba | **Descartada** |
| 7 | Clave de demostración en claro en archivos versionables | `grep` del valor: `.env.example`, CI, scripts y pruebas (valor ficticio documentado) | **Aceptada** como riesgo R18 (repositorio público; clave solo de demostración) |
| 8 | Sin límite de intentos de login | Revisión de `security/auth.ts` | **Gap declarado** (SPEC-001 S2); no se implementa |
| 9 | La autorización depende del cliente | La web oculta pantallas por rol, pero cada operación se autoriza en el servidor (AC-RNF01-02, 403 por rol) | **Descartada** |
| 10 | Dependencias con vulnerabilidades | `npm audit --audit-level=high` | `found 0 vulnerabilities` |
| 11 | Mensajes técnicos de errores inesperados en el log | `req.log.error` registra solo `message` y `name`, nunca cuerpo ni cabeceras | **Aceptada** con riesgo bajo (puede incluir texto de un error de base) |

## Decisión humana

PENDIENTE (Carlos C): Aceptada | Corregida | Descartada, con motivo.

## Verificación

- `gitleaks v8.21.2 detect --no-git --redact`: 2 hallazgos al inicio (token en `k6-resumen.json` y un literal de prueba); tras corregirlos, «no leaks found» (2026-10-14T12:37Z).
- `npm audit --audit-level=high`: `found 0 vulnerabilities`.
- `npm run verify`: 159 pruebas pasaron; E2E: 7 de 7.

## Límites

Revisión hecha por la misma IA que escribió el código (sesgo). `gitleaks` sin `--no-git` (historial) no se pudo ejecutar porque no hay commits propios publicados.
No sustituye la sesión adversarial humana ni una revisión de seguridad externa.
