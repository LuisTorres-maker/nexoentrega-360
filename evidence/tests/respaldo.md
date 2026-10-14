# Respaldo y restauración (prueba real)

- Fecha y hora UTC: 2026-10-14T12:35:06Z
- Entorno: PostgreSQL 16.4 en Docker Compose local (contenedor `db`), datos tras la prueba de carga y las pruebas E2E.
- Comandos:

```bash
docker compose exec -T db pg_dump -U nexo nexo > backup.sql
docker compose exec -T db psql -U nexo -d postgres -c "CREATE DATABASE nexo_restore"
docker compose exec -T db psql -U nexo -d nexo_restore -v ON_ERROR_STOP=1 -q < backup.sql
```

- Tamaño del respaldo: 303.441 bytes.

| Medida | Base original | Base restaurada |
|---|---|---|
| Solicitudes | 2.008 | 2.008 |
| Usuarios | 9 | 9 |
| Inventario físico / reservado | 51 / 0 | 51 / 0 |
| Eventos de auditoría | 8 | 8 |
| Migraciones y seeds registrados | 4 | 4 |

Resultado: **la restauración coincide en todas las medidas**. La base `nexo_restore` se eliminó después de la comparación.
Límite: se probó en la misma instancia de Docker; el ensayo en otro computador queda para el equipo.
