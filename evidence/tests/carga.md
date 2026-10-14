# Prueba de carga (RNF03)

- Fecha y hora UTC de inicio: 2026-10-14T12:59:46.606Z
- Fecha y hora UTC de fin: 2026-10-14T13:00:52.783Z
- Commit (HEAD; el árbol puede tener cambios sin commit): `8bc35658adca48a738e30d2b9a4e392479c11f1d`
- Herramienta: k6 v0.55.0 (commit/90bb9415d0, go1.23.3, linux/amd64) (imagen `grafana/k6:0.55.0`)
- Hardware: AMD Ryzen AI 5 330 w/ Radeon 820M · 8 hilos · 15.1 GiB de RAM · Windows_NT 10.0.26200
- Entorno: API y PostgreSQL 16.4 en Docker Compose local (no Supabase)
- Datos: 2008 solicitudes en la base (2.000 sembradas con `seeds/002_load.sql`)
- Escenario: 20 usuarios virtuales, 5 s de calentamiento y 60 s de medición; `GET /requests?page=N&pageSize=50&status=ENVIADA` y `GET /dashboard` como COORDINADOR de ORG-A; sin IA

## Resultado

| Métrica (fase de medición) | Valor | Umbral |
|---|---|---|
| p95 de duración (ms) | 40.7 | ≤ 700 |
| Mediana (ms) | 28.1 | — |
| Promedio (ms) | 29.0 | — |
| Máximo (ms) | 86.4 | — |
| Tasa de error | 0.00 % | < 1 % |

**Veredicto: CUMPLE** el umbral de RNF03 en esta máquina.

Historial de todas las corridas (la variación es real): `evidence/tests/carga-historial.csv`. Tres corridas el 2026-10-14: p95 de 41,5, 152,9 y 40,7 ms; la de 152,9 ms se hizo mientras terminaban procesos en segundo plano de la simulación de PR.

Datos crudos de esta corrida: `evidence/tests/k6-resumen.json`. Reproducir: `npm run up` y `npm run load`.
