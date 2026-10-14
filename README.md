# NexoEntrega 360

Sistema web para que dos organizaciones comunitarias de Barranquilla (ORG-A y ORG-B) registren
solicitudes de kits, reserven existencias sin prometer dos veces el mismo inventario, controlen el
despacho y la entrega, y conserven un historial de auditoría. Un asistente de IA ayuda al coordinador
a resumir solicitudes pendientes; nunca decide ni mueve inventario.

Se desarrolla con **desarrollo basado en especificaciones (SDD)** y asistencia de IA:
requerimiento → historia → SPEC → código → prueba.

> **Estado:** API completa con base real, asistente de IA con validación y respaldo, interfaz web (React) y Docker Compose.
> 159 pruebas con base real y 7 E2E con Playwright; prueba de carga con k6 (p95 41,5 ms en la máquina de desarrollo).
> Pendientes declarados: clon limpio en otro computador, verificación manual de RNF05, sesión adversarial y respuesta real de un LLM.
> Todo el estado de cada requisito está en `evidence/traceability.csv` y `evidence/spec-vs-code.csv`.

## Equipo

Luis, Andrés, Jhoimer, Said, Carlos C y Carlos B. Datos y reparto en `docs/EQUIPO.md`.

## Requisitos para trabajar

| Herramienta    | Versión de referencia                    | Para qué                                                |
| -------------- | ---------------------------------------- | ------------------------------------------------------- |
| Node.js        | 24.15.0 (archivo `.nvmrc`; mínimo 22.12) | API, scripts y pruebas                                  |
| npm            | 11.12.1                                  | Dependencias con `package-lock.json`                    |
| Python         | 3.13 (la usada en R0)                    | Exportador de SPECS y verificador de trazabilidad       |
| Docker Desktop | 29.x con Compose v5                      | Base de pruebas local (y, desde R7, toda la aplicación) |
| Git            | 2.54                                     | Control de versiones                                    |

En Windows use **Git Bash** para los comandos de este repositorio.

## Versiones instaladas

Todas están fijadas con versión exacta en `package.json` y `package-lock.json`. Se instalan con `npm ci`.

| Paquete              | Versión | Dónde    | Para qué                                                                               |
| -------------------- | ------- | -------- | -------------------------------------------------------------------------------------- |
| typescript           | 6.0.3   | raíz     | Lenguaje (modo `strict`). Se usa la 6.0 porque `typescript-eslint` 8.71 no admite la 7 |
| eslint               | 10.12.0 | raíz     | Análisis estático                                                                      |
| @eslint/js           | 10.0.1  | raíz     | Reglas base de ESLint                                                                  |
| typescript-eslint    | 8.71.2  | raíz     | Reglas de ESLint para TypeScript                                                       |
| globals              | 17.13.0 | raíz     | Variables globales de Node para ESLint                                                 |
| prettier             | 3.9.10  | raíz     | Formato del código                                                                     |
| vitest               | 5.0.4   | raíz     | Pruebas unitarias y de integración                                                     |
| @types/node          | 24.19.2 | raíz     | Tipos de Node 24                                                                       |
| pg                   | 8.23.1  | apps/api | Cliente de PostgreSQL (SQL directo, sin ORM)                                           |
| dotenv               | 18.0.7  | apps/api | Lee `.env` en desarrollo                                                               |
| bcryptjs             | 3.0.3   | apps/api | Hash bcrypt de las contraseñas de demostración (`seed:gen`) y, desde R3, el login      |
| @types/pg            | 8.23.1  | apps/api | Tipos de `pg`                                                                          |
| express              | 4.22.3  | apps/api | API HTTP (Express 4)                                                                   |
| zod                  | 4.6.7   | apps/api | Validación de entrada y de salida de IA                                                |
| pino                 | 10.4.0  | apps/api | Logs JSON con correlationId                                                            |
| supertest            | 7.3.1   | apps/api | Pruebas HTTP                                                                           |
| @types/express       | 4.17.25 | apps/api | Tipos de Express                                                                       |
| @types/supertest     | 7.2.1   | apps/api | Tipos de Supertest                                                                     |
| react                | 19.3.0  | apps/web | Interfaz                                                                               |
| react-dom            | 19.3.0  | apps/web | Interfaz                                                                               |
| react-router-dom     | 7.18.4  | apps/web | Rutas de la interfaz                                                                   |
| vite                 | 8.3.4   | apps/web | Servidor y empaquetado de la web                                                       |
| @vitejs/plugin-react | 6.1.2   | apps/web | Plugin de React para Vite                                                              |
| @playwright/test     | 1.64.0  | apps/web | Pruebas E2E                                                                            |
| @types/react         | 19.3.0  | apps/web | Tipos de React                                                                         |
| @types/react-dom     | 19.3.0  | apps/web | Tipos de React DOM                                                                     |

Imágenes de Docker: `postgres:16.4`, `node:24.15.0-alpine`, `nginx:1.27.2-alpine` y `grafana/k6:0.55.0`.

Herramientas que se ejecutan con `npx` y no quedan instaladas: `@redocly/cli` 2.63.0 (valida
`contracts/openapi.yaml`) y `@mermaid-js/mermaid-cli` 11.4.2 (valida los diagramas de `docs/diagramas/`).

## Cómo arrancar (se completa en rondas posteriores)

```bash
# 1) Clonar e instalar (versiones exactas)
git clone https://github.com/LuisTorres-maker/nexoentrega-360.git
cd nexoentrega-360
npm ci

# 2) Crear su archivo de variables (nunca se versiona) y completar los valores
cp .env.example .env

# 3) Levantar la base local de pruebas (requiere Docker Desktop abierto)
npm run db:test:up

# 4) Verificar: lint + tipos + pruebas (las de base real usan esa base local)
npm run verify
```

Las pruebas de integración usan la base local de pruebas (`TEST_DATABASE_URL`, por defecto
`localhost:54329`). Sin ella `npm run verify` falla en `tests/integration/db.test.ts`.

Cómo levantar toda la aplicación con un solo comando (`npm run up`) se documenta en R7.

## Comandos

| Comando                                                           | Qué hace                                                                                                                         | Estado en R0                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `npm run verify`                                                  | lint + tipos + pruebas                                                                                                           | Funciona                      |
| `npm run lint` · `typecheck` · `test` · `build`                   | Pasos sueltos                                                                                                                    | Funciona                      |
| `npm run format`                                                  | Da formato con Prettier                                                                                                          | Funciona                      |
| `npm run db:check`                                                | **Solo lectura.** Conecta a `DATABASE_URL`, muestra versión, tablas, RLS y conteos                                               | Funciona                      |
| `npm run db:test:up` · `db:test:down`                             | Levanta o apaga Postgres local de pruebas (puerto 54329)                                                                         | Funciona con Docker           |
| `npm run migrate` · `seed` · `seed:load`                          | Aplican `migrations/*.sql`, `seeds/001_base.sql` y `seeds/002_load.sql` (2.000 solicitudes) a una base **local**                 | Funciona                      |
| `npm run seed:gen` · `seed:check`                                 | Genera los tres archivos de `seeds/` con hashes bcrypt de `DEMO_PASSWORD`, o comprueba que no divergen                           | Funciona                      |
| `npm run specs` · `specs:check`                                   | Exporta o comprueba `spec.json` desde `spec.md`                                                                                  | Funciona (5 SPECS)            |
| `npm run trace:check`                                             | Verifica la trazabilidad. En rondas intermedias: `node scripts/py.mjs scripts/check_trace.py --fase R1`                          | Funciona en `--fase R1`       |
| `npm run up` · `down`                                             | Levanta (o apaga) base local, API y web con Docker Compose; interfaz en `http://localhost:8080` y API en `http://localhost:3000` | Funciona                      |
| `npm run e2e`                                                     | E2E con Playwright (7 pruebas; requiere `npm run up`; reinicia los datos de la base de Docker)                                   | Funciona                      |
| `npm run load`                                                    | Prueba de carga con k6 (20 usuarios, 60 s, 2.000 solicitudes); escribe `evidence/tests/carga.md`                                 | Funciona                      |
| `npm run build`                                                   | Compila la API a `apps/api/dist`                                                                                                 | Funciona                      |
| `node apps/api/dist/server.js`                                    | Arranca la API (usa `DATABASE_URL` de `.env`; puerto `PORT`)                                                                     | Funciona tras `npm run build` |
| `python3 scripts/gen_evidencia.py --reporte <json> [--sha <sha>]` | Genera `spec-vs-code.csv` y el estado de `traceability.csv` desde el reporte de Vitest                                           | Funciona                      |

Para aplicar migraciones a la base local de pruebas desde Git Bash:

```bash
DATABASE_URL="postgresql://nexo:test@localhost:54329/nexo_test" npm run migrate
```

`migrate` y `seed` se niegan a correr si la URL apunta a Supabase. `seeds/000_reset_demo.sql` **borra todos los datos** y solo se
ejecuta a mano (SQL Editor o base local); ningún script lo ejecuta.

## Asistente de IA

El coordinador pide un resumen de hasta 20 solicitudes ENVIADA. El adaptador recibe solo seis campos autorizados y su salida
se valida con esquema cerrado y en código. Si es inválida, hay timeout (5 s) o falla el proveedor, el sistema entrega un resumen
determinista con aviso. La IA nunca reserva, despacha ni cambia prioridad.

| `AI_PROVIDER`          | Comportamiento                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `replay` (por defecto) | Reproduce `evidence/ai-real/respuesta.json` (respuesta real capturada, no una invocación en vivo); si no existe, resumen alternativo |
| `fixture`              | Usa uno de los 7 fixtures oficiales (`AI_FIXTURE_ID`, por defecto `AI-VALID`)                                                        |
| `off`                  | Siempre resumen alternativo; no llama a ningún proveedor                                                                             |

## Base de datos

- **Demostración del equipo:** PostgreSQL alojado en Supabase. La API entra con una cadena de conexión
  Postgres (`DATABASE_URL`) y usa SQL directo con transacciones. No se usa la API REST de Supabase ni
  `supabase-js`. El SQL (`migrations/` y `seeds/`) se pega a mano en el SQL Editor.
- **Pruebas y arranque reproducible:** PostgreSQL 16.4 local en Docker. Las pruebas vacían tablas, por
  eso **nunca** corren contra Supabase (el helper `assertSafeTestDb` lo impide).
- La conexión directa de Supabase usa IPv6 y falla en muchas redes. Si `npm run db:check` agota el
  tiempo, use la cadena **Session pooler** (Supabase → botón _Connect_ → _Session pooler_).

### Aplicar el SQL en Supabase (lo hace una persona, nunca un script)

En el panel de Supabase: **SQL Editor** → **New query**, pegar el contenido de cada archivo **en este orden** y pulsar **Run**:

1. `migrations/001_init.sql` (tablas, restricciones, disparador de auditoría)
2. `migrations/002_security.sql` (RLS activo y revocaciones: la clave pública no lee ni escribe)
3. `seeds/001_base.sql` (organizaciones, SKU, inventario, 9 cuentas y 5 solicitudes)

Son idempotentes: ejecutarlos otra vez no duplica nada. Después se verifica con `npm run db:check` (solo lectura).
Para volver al estado inicial de la demo se ejecuta a mano `seeds/000_reset_demo.sql` (borra todo y vuelve a sembrar).

## Operación

Arranque, comprobaciones, IA apagada, respaldo, reversión y problemas conocidos: `docs/runbook.md`.
Ensayo de clon limpio: `bash scripts/clon-limpio.sh`.

## Variables de entorno

Se definen en `.env` (ignorado por Git). `.env.example` trae solo marcadores de posición.

| Variable                        | Qué es                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`, `LOG_LEVEL` | Modo, puerto de la API (3000) y nivel de logs                                   |
| `DATABASE_URL`, `DATABASE_SSL`  | Base de la aplicación (demo en Supabase; `DATABASE_SSL=true`)                   |
| `TEST_DATABASE_URL`             | Base local solo para pruebas (por defecto `localhost:54329`)                    |
| `DEMO_PASSWORD`                 | Clave ficticia de las cuentas de demostración                                   |
| `AI_PROVIDER`, `AI_TIMEOUT_MS`  | Proveedor del asistente (`replay`, `fixture`, `http`, `off`) y su límite de 5 s |
| `SESSION_HOURS`                 | Duración de la sesión (8 horas)                                                 |

> **Credenciales solo de demostración.** Las cuentas `org-{a|b}-{solicitante|coordinador|bodega|auditor}@example.test`
> y su clave son ficticias y existen únicamente para probar el sistema. No use claves reales.
> La clave de demostración se toma de `DEMO_PASSWORD` y se regenera con `npm run seed:gen`. Los seeds guardan
> solo su hash bcrypt (coste 10).

## Datos semilla: cómo se traducen los hechos del caso

El archivo `docs/anexos/fixture-scenarios.json` describe **hechos del caso**, no el esquema. Así se
traducen al esquema de la base (el detalle completo irá en `docs/data-model.md`, R2):

| Hecho del caso (`fixture-scenarios.json`) | Esquema de la base                  | Nota                                              |
| ----------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `organizations[]` (`ORG-A`, `ORG-B`)      | `organizations.id`                  | Texto, igual al valor del caso                    |
| `stock[].organizationId`                  | `inventory.org_id`                  | Clave foránea a `organizations.id`                |
| `stock[].sku`                             | `skus.code`                         | La fila de `inventory` apunta a `skus.id`         |
| `stock[].onHand`                          | `inventory.on_hand`                 | Existencia física                                 |
| `stock[].reserved`                        | `inventory.reserved`                | Cantidad reservada                                |
| `stock[].active`                          | `skus.active`                       |                                                   |
| `accounts[].login`                        | `users.email`                       | Contraseña: hash bcrypt de `DEMO_PASSWORD`        |
| `accounts[].role`                         | `users.role`                        | `SOLICITANTE`, `COORDINADOR`, `BODEGA`, `AUDITOR` |
| `accounts[].organizationId`               | `users.org_id`                      |                                                   |
| `requests[].requestId`                    | `requests.code`                     | `A-001`, `A-002`, `B-001` (identificador público) |
| `requests[].ownerLogin`                   | `requests.requester_id`             | Se resuelve por `users.email`                     |
| `requests[].zona`                         | `requests.zone`                     |                                                   |
| `requests[].prioridad`                    | `requests.priority`                 |                                                   |
| `requests[].fechaRequerida`               | `requests.required_date`            | `timestamptz` en UTC                              |
| `requests[].observaciones`                | `requests.notes`                    | Máximo 500 caracteres                             |
| `requests[].lines[].sku` / `quantity`     | `request_lines.sku_id` / `quantity` | Un SKU por solicitud                              |
| `clockUtc`                                | Reloj inyectado en las pruebas      | `2030-01-10T14:00:00Z`                            |

## Estructura del repositorio

```
apps/api/        API (Express), servicios, seguridad, asistente de IA y su Dockerfile
apps/web/        Interfaz web (React y Vite) y su Dockerfile
contracts/       Contrato OpenAPI y esquema de salida de IA
docs/            Plan, ADR, diagramas, modelo de datos, tareas, actas de hito y anexos oficiales
evidence/        Trazabilidad, bitácora de IA, riesgos y resultados de pruebas
migrations/      SQL del esquema (idempotente)
seeds/           SQL de datos semilla
scripts/         Utilidades (base de datos, seeds, SPECS, trazabilidad y experimento de concurrencia)
specs/           Constitución y las cinco SPECS (spec.md es la fuente; spec.json se exporta)
tests/           unit, integration (base real) y e2e (Playwright)
loadtest/        Prueba de carga (k6)
```

## Reglas del equipo

- Nadie sube directo a `main` (salvo el primer commit del repositorio).
- No se une un PR sin 1 aprobación de una persona distinta del autor y sin CI en verde.
- Cada PR cita RF y AC, declara el uso de IA y lleva el trailer `Asistido-por-IA` si el contenido fue
  generado con asistencia.
- Los secretos viven solo en `.env`. Nunca en el repositorio, en PR ni en logs.
- Mensajes de commit: `tipo(alcance): resumen (RFxx, AC-xxx)`.
