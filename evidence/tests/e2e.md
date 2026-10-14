# Reporte de pruebas E2E (Playwright)

- Fecha y hora UTC: 2026-10-14T12:37:37Z
- Commit: HEAD `8bc3565` más cambios sin commit (árbol de trabajo; **no** es un SHA unido)
- Entorno: Windows 11 (Git Bash), Node 24.15.0, Chromium headless de Playwright 1.64.0; interfaz con Vite (`http://127.0.0.1:5173`) y API y PostgreSQL 16.4 en Docker Compose local
- Datos: la base de Docker se reinicia antes de correr con `seeds/000_reset_demo.sql` (`tests/e2e/global-setup.ts`)
- Comando: `npm run up && npm run e2e`
- Reporte JSON: `test-results/e2e.json` (no versionado)

## Oráculo definido antes de ejecutar

El recorrido repite el de la API: solicitante crea y envía, coordinador reserva, bodega despacha y coordinador entrega; la auditoría muestra
ENVIAR, RESERVAR, DESPACHAR y ENTREGAR. Cancelar una RESERVADA debe pasar `Reservado` de 3 a 0 en el tablero. A 390 px y 1366 px,
`document.documentElement.scrollWidth <= window.innerWidth`.

## Resultado observado

| # | Prueba | AC | Resultado |
|---|---|---|---|
| 1 | Solicitante crea y envía; coordinador reserva; bodega despacha; coordinador entrega; auditoría | AC-RF04-11 (por interfaz) | Pasó |
| 2 | Cancelar una RESERVADA libera el stock (`Reservado: 3` → `Reservado: 0`) | AC-RF06-01 (por interfaz) | Pasó |
| 3 | Resumen de IA marcado como asistencia de IA, como texto y con Aprobar aparte | AC-RF12-01 | Pasó |
| 4 | Error 422 asociado al campo con `role="alert"`, `aria-describedby` y `aria-invalid` | AC-RNF05-03 | Pasó |
| 5 | Sin desbordamiento horizontal a 390 px | AC-RNF05-01 | Pasó |
| 6 | Sin desbordamiento horizontal a 1366 px | AC-RNF05-01 | Pasó |
| 7 | Login y creación de solicitud con teclado | AC-RNF05-02 | Pasó |

**Total: 7 ejecutadas, 7 pasaron, 0 fallaron.** Corrida anterior (2026-10-14T12:30Z): 4 pasaron y 3 fallaron por diseño de la prueba, no del producto (ver `evidence/defects.md`, P-04 y P-05).

## Defectos y decisión

Ningún defecto del producto. Dos pruebas se corrigieron (selector de la solicitud nueva y recorrido de Tab por el campo de fecha).

## Límites

Un solo navegador (Chromium) y una sola máquina. La prueba de teclado no recorre el campo de fecha con teclas. No se verificó la lectura con un lector de pantalla.
