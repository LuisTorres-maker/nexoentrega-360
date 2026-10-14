# Runbook de NexoEntrega 360

Versión: v0.1 (ronda R7). Todos los comandos son para **Git Bash** (Windows) o una terminal Linux o macOS, desde la raíz del repositorio.

## 1. Requisitos y versiones fijadas

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 24.15.0 (`.nvmrc`; mínimo 22.12) | Scripts y pruebas |
| npm | 11.12.1 | `npm ci` con `package-lock.json` |
| Docker Desktop | 29.x con Compose v5 | Base, API y web |
| Python | 3.13 (sirve 3.10 o más) | Exportador de SPECS y trazabilidad |
| PostgreSQL (imagen) | `postgres:16.4` | Datos |
| nginx (imagen) | `nginx:1.27.2-alpine` | Sirve la web |
| k6 (imagen) | `grafana/k6:0.55.0` | Prueba de carga |

Dependencias de la aplicación con versión exacta en `package.json` y `package-lock.json`; se instalan con `npm ci`.

## 2. Configuración sin secretos

```bash
cp .env.example .env     # completar los valores; .env no se versiona
```

| Variable | Qué es | Valor para Docker Compose |
|---|---|---|
| `DATABASE_URL`, `DATABASE_SSL` | Base de la demo en Supabase (solo `npm run db:check` y el arranque contra Supabase) | No se usa en `npm run up` |
| `TEST_DATABASE_URL` | Base local solo para pruebas | `postgresql://nexo:test@localhost:54329/nexo_test` |
| `DEMO_PASSWORD` | Clave ficticia de las 9 cuentas de demostración | La de `.env.example` |
| `AI_PROVIDER` | `replay`, `fixture` u `off` | `replay` por defecto |
| `AI_TIMEOUT_MS`, `SESSION_HOURS`, `LOG_LEVEL` | Tiempo máximo de IA, duración de sesión, nivel de logs | 5000, 8 e `info` |

Las variables de la API en Compose están en `docker-compose.yml` y no incluyen secretos (`DB_PASSWORD` tiene un valor ficticio por defecto).

## 3. Arranque desde un clon limpio

```bash
git clone https://github.com/LuisTorres-maker/nexoentrega-360.git
cd nexoentrega-360
npm ci                    # opcional para solo ejecutar; necesario para pruebas
npm run up                # db (PostgreSQL 16.4), api y web; aplica migraciones y seed
```

Cuando termina: interfaz en <http://localhost:8080>, API en <http://localhost:3000>.
Parada: `npm run down` (conserva los datos en el volumen `dbdata`). Para borrarlos: `docker compose down -v`.

El arranque automático aplica `migrations/*.sql` y `seeds/001_base.sql` (idempotentes) cada vez que se inicia la API.
El cronometraje del clon limpio se mide con `bash scripts/clon-limpio.sh` (sección 9).

## 4. Comprobaciones

```bash
curl -s http://localhost:3000/health     # {"status":"ok"}            proceso vivo
curl -s http://localhost:3000/ready      # {"status":"ready"}         la base responde (503 si no)
curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"org-a-coordinador@example.test","password":"<DEMO_PASSWORD>"}'   # devuelve un token
```

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `/ready` responde 503 | La base no responde | `docker compose ps`; `docker compose logs db` |
| Login responde 401 con la clave correcta | Los seeds se generaron con otro `DEMO_PASSWORD` | `npm run seed:gen` y aplicar `seeds/000_reset_demo.sql` a mano |
| El navegador no carga datos | La web no alcanza `/api` | `docker compose logs web api` |

## 4b. Cuentas ficticias

`org-{a|b}-{solicitante|coordinador|bodega|auditor}@example.test` y `org-a-solicitante2@example.test`. La contraseña es `DEMO_PASSWORD`
(ficticia, solo demostración). No use claves reales.

## 5. Datos

| Archivo | Uso | Cómo |
|---|---|---|
| `seeds/001_base.sql` | Estado inicial del caso (5 solicitudes, 9 cuentas) | Se aplica solo al arrancar la API |
| `seeds/002_load.sql` | 2.000 solicitudes para la carga | `npm run load` (lo aplica) o `npm run seed:load` en una base local |
| `seeds/000_reset_demo.sql` | **Borra todo** y vuelve al estado inicial | Solo a mano: `docker compose exec -T db psql -U nexo -d nexo < seeds/000_reset_demo.sql` |

## 6. Pruebas y carga

```bash
npm run db:test:up        # base local de pruebas (puerto 54329)
npm run verify            # formato + lint + tipos + 159 pruebas con base real
npm run up && npm run e2e # E2E con Playwright (reinicia los datos de la base de Docker)
npm run load              # k6: 20 usuarios, 60 s, 2.000 solicitudes; escribe evidence/tests/carga.md

> **Después de `npm run load` o `npm run e2e`**, la base local queda con datos de prueba (las 2.000 solicitudes `L-…` tienen fecha 2030 y tapan en la lista a las nuevas). Antes de una demostración vuelva al estado inicial: `docker compose exec -T db psql -U nexo -d nexo < seeds/000_reset_demo.sql` (solo base local; nunca contra Supabase sin intención).
```

## 7. Qué hacer cuando falla la IA

El resto del sistema sigue funcionando: ante salida inválida, timeout de 5 s o fallo del proveedor, la API devuelve un **resumen determinista**
con aviso. Para apagar la IA por completo:

```bash
AI_PROVIDER=off docker compose up -d api      # no llama a ningún proveedor
```

`AI_PROVIDER=replay` (por defecto) reproduce `evidence/ai-real/respuesta.json` (respuesta real capturada, no invocación en vivo); si el archivo no existe, degrada
al resumen alternativo. `AI_PROVIDER=fixture` con `AI_FIXTURE_ID=AI-VALID` (u otro de los 7) sirve para demostrar cada caso.

## 8. Logs y correlación

Los logs de la API son JSON con `correlationId` (el encabezado `x-correlation-id` válido se conserva; si no, se genera) y sin contraseñas, tokens ni `Authorization`.
`docker compose logs -f api`. Para seguir una petición, busque su `correlationId` (se devuelve en el encabezado de respuesta y en cada error).

## 9. Clon limpio cronometrado

```bash
bash scripts/clon-limpio.sh [URL_DEL_REPOSITORIO]
```

Clona en una carpeta temporal, ejecuta `npm ci` y `npm run up`, y espera `/ready` 200 y un login. Imprime los tiempos de **descarga inicial** (imágenes y paquetes) y de
**arranque** por separado, para comparar con RNF04 (≤ 15 min sin contar la descarga inicial). El ensayo definitivo debe hacerlo una persona en **otro computador**
y pegar la salida en `evidence/tests/clon-limpio.md`.

## 10. Reversión y compatibilidad de esquema

- **Aplicación:** volver a una etiqueta anterior (`git checkout <etiqueta>`) y `npm run up`. Los cambios de esquema son **aditivos** (nuevas migraciones `003_*.sql`);
  una migración aplicada nunca se edita. La versión anterior de la API es compatible con el esquema más nuevo mientras las nuevas columnas admitan `NULL` o tengan valor por defecto.
- **Datos:** respaldo y restauración con `pg_dump` y `psql`:

```bash
docker compose exec -T db pg_dump -U nexo nexo > backup.sql          # respaldar
docker compose exec -T db psql -U nexo -d nexo < backup.sql          # restaurar sobre una base vacía
```

Probado el 2026-10-14 en la base local de Docker (ver `evidence/tests/respaldo.md`).

## 11. Supabase (demostración del equipo)

Postgres alojado para la demo: ver README, sección «Aplicar el SQL en Supabase». Si la conexión directa agota el tiempo (IPv6), use la cadena **Session pooler**.
`npm run db:check` verifica (solo lectura). El proyecto gratuito se pausa por inactividad: reanudarlo en el panel.

## 12. Problemas conocidos

| Problema | Impacto | Mitigación |
|---|---|---|
| Conexión directa de Supabase solo IPv6 | `db:check` agota el tiempo en redes IPv4 | Cadena Session pooler |
| `npm run verify` necesita la base de pruebas | Falla en `db.test.ts` sin Docker | `npm run db:test:up` |
| Un worker de Vitest murió al arrancar con el pool `forks` en Windows | Fallo intermitente del arnés | `pool: threads` (R3-H14) |
| El proveedor `replay` no tiene respuesta real hasta que una persona la captura | Resumen alternativo | `evidence/ai-real/PROMPT.md` |

## 13. Tiempo medido de instalación

Ver `evidence/tests/clon-limpio.md` (se llena con la salida de `scripts/clon-limpio.sh`).
