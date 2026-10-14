# NexoEntrega 360

Sistema web para que dos organizaciones comunitarias de Barranquilla (ORG-A y ORG-B) registren
solicitudes de kits, reserven existencias sin prometer dos veces el mismo inventario, controlen el
despacho y la entrega, y conserven un historial de auditoría. Un asistente de IA ayuda al coordinador
a resumir solicitudes pendientes; nunca decide ni mueve inventario.

Se desarrolla con **desarrollo basado en especificaciones (SDD)** y asistencia de IA:
requerimiento → historia → SPEC → código → prueba.

> **Estado:** ronda R0 (andamiaje). Todavía no hay lógica de negocio: primero se escriben y aprueban
> las SPECS (carpeta `specs/`).

## Equipo

Luis, Andrés, Jhoimer, Said, Carlos C y Carlos B. Datos y reparto en `docs/EQUIPO.md`.

## Requisitos para trabajar

| Herramienta | Versión de referencia | Para qué |
|---|---|---|
| Node.js | 24.15.0 (archivo `.nvmrc`; mínimo 22.12) | API, scripts y pruebas |
| npm | 11.12.1 | Dependencias con `package-lock.json` |
| Python | 3.13 (la usada en R0) | Exportador de SPECS y verificador de trazabilidad |
| Docker Desktop | 29.x con Compose v5 | Base de pruebas local (y, desde R7, toda la aplicación) |
| Git | 2.54 | Control de versiones |

En Windows use **Git Bash** para los comandos de este repositorio.

## Versiones instaladas (R0)

Todas están fijadas con versión exacta en `package.json` y `package-lock.json`. Se instalan con `npm ci`.

| Paquete | Versión | Dónde | Para qué |
|---|---|---|---|
| typescript | 6.0.3 | raíz | Lenguaje (modo `strict`). Se usa la 6.0 porque `typescript-eslint` 8.71 no admite la 7 |
| eslint | 10.12.0 | raíz | Análisis estático |
| @eslint/js | 10.0.1 | raíz | Reglas base de ESLint |
| typescript-eslint | 8.71.2 | raíz | Reglas de ESLint para TypeScript |
| globals | 17.13.0 | raíz | Variables globales de Node para ESLint |
| prettier | 3.9.10 | raíz | Formato del código |
| vitest | 5.0.4 | raíz | Pruebas unitarias y de integración |
| @types/node | 24.19.2 | raíz | Tipos de Node 24 |
| pg | 8.23.1 | apps/api | Cliente de PostgreSQL (SQL directo, sin ORM) |
| dotenv | 18.0.7 | apps/api | Lee `.env` en desarrollo |
| @types/pg | 8.23.1 | apps/api | Tipos de `pg` |

Imagen de base de datos de pruebas: `postgres:16.4`.

Paquetes previstos para rondas posteriores (versión consultada con `npm view` el 2026-10-14; se fija
al instalarlos): express 4.22.3, zod 4.6.7, bcryptjs 3.0.3, pino 10.4.0, supertest 7.3.1, ajv 8.20.0,
react 19.3.0, react-dom 19.3.0, react-router-dom 7.18.4, vite 8.3.4, @vitejs/plugin-react 6.1.2,
@playwright/test 1.64.0, @redocly/cli 2.63.0.

## Cómo arrancar (se completa en rondas posteriores)

```bash
# 1) Clonar e instalar (versiones exactas)
git clone https://github.com/LuisTorres-maker/nexoentrega-360.git
cd nexoentrega-360
npm ci

# 2) Crear su archivo de variables (nunca se versiona) y completar los valores
cp .env.example .env

# 3) Verificar: lint + tipos + pruebas
npm run verify

# 4) Base local de pruebas (requiere Docker Desktop abierto)
npm run db:test:up
```

Cómo levantar toda la aplicación con un solo comando (`npm run up`) se documenta en R7.

## Comandos

| Comando | Qué hace | Estado en R0 |
|---|---|---|
| `npm run verify` | lint + tipos + pruebas | Funciona |
| `npm run lint` · `typecheck` · `test` · `build` | Pasos sueltos | Funciona |
| `npm run format` | Da formato con Prettier | Funciona |
| `npm run db:check` | **Solo lectura.** Conecta a `DATABASE_URL`, muestra versión, tablas, RLS y conteos | Funciona |
| `npm run db:test:up` · `db:test:down` | Levanta o apaga Postgres local de pruebas (puerto 54329) | Funciona con Docker |
| `npm run migrate` · `seed` | Aplican `migrations/*.sql` y `seeds/001_base.sql` a una base **local** | Sin archivos hasta R2 |
| `npm run specs` · `specs:check` | Exporta o comprueba `spec.json` desde `spec.md` | Falla sin SPECS (normal en R0) |
| `npm run trace:check` | Verifica la trazabilidad (`--fase R1` en rondas intermedias) | Desde R1 |
| `npm run seed:gen` · `up` · `down` · `e2e` · `load` | Pendientes | `NO IMPLEMENTADO` (código de salida 2) |

Para aplicar migraciones a la base local de pruebas desde Git Bash:

```bash
DATABASE_URL="postgresql://nexo:test@localhost:54329/nexo_test" npm run migrate
```

`migrate` y `seed` se niegan a correr si la URL apunta a Supabase.

## Base de datos

- **Demostración del equipo:** PostgreSQL alojado en Supabase. La API entra con una cadena de conexión
  Postgres (`DATABASE_URL`) y usa SQL directo con transacciones. No se usa la API REST de Supabase ni
  `supabase-js`. El SQL (`migrations/` y `seeds/`) se pega a mano en el SQL Editor.
- **Pruebas y arranque reproducible:** PostgreSQL 16.4 local en Docker. Las pruebas vacían tablas, por
  eso **nunca** corren contra Supabase (el helper `assertSafeTestDb` lo impide).
- La conexión directa de Supabase usa IPv6 y falla en muchas redes. Si `npm run db:check` agota el
  tiempo, use la cadena **Session pooler** (Supabase → botón *Connect* → *Session pooler*).

## Variables de entorno

Se definen en `.env` (ignorado por Git). `.env.example` trae solo marcadores de posición.

| Variable | Qué es |
|---|---|
| `NODE_ENV`, `PORT`, `LOG_LEVEL` | Modo, puerto de la API (3000) y nivel de logs |
| `DATABASE_URL`, `DATABASE_SSL` | Base de la aplicación (demo en Supabase; `DATABASE_SSL=true`) |
| `TEST_DATABASE_URL` | Base local solo para pruebas (por defecto `localhost:54329`) |
| `DEMO_PASSWORD` | Clave ficticia de las cuentas de demostración |
| `AI_PROVIDER`, `AI_TIMEOUT_MS` | Proveedor del asistente (`replay`, `fixture`, `http`, `off`) y su límite de 5 s |
| `SESSION_HOURS` | Duración de la sesión (8 horas) |

> **Credenciales solo de demostración.** Las cuentas `org-{a|b}-{solicitante|coordinador|bodega|auditor}@example.test`
> y su clave son ficticias y existen únicamente para probar el sistema. No use claves reales.
> La clave de demostración se toma de `DEMO_PASSWORD` y se regenera con `npm run seed:gen` (R2).

## Datos semilla: cómo se traducen los hechos del caso

El archivo `docs/anexos/fixture-scenarios.json` describe **hechos del caso**, no el esquema. Así se
traducen al esquema de la base (el detalle completo irá en `docs/data-model.md`, R2):

| Hecho del caso (`fixture-scenarios.json`) | Esquema de la base | Nota |
|---|---|---|
| `organizations[]` (`ORG-A`, `ORG-B`) | `organizations.id` | Texto, igual al valor del caso |
| `stock[].organizationId` | `inventory.org_id` | Clave foránea a `organizations.id` |
| `stock[].sku` | `skus.code` | La fila de `inventory` apunta a `skus.id` |
| `stock[].onHand` | `inventory.on_hand` | Existencia física |
| `stock[].reserved` | `inventory.reserved` | Cantidad reservada |
| `stock[].active` | `skus.active` | |
| `accounts[].login` | `users.email` | Contraseña: hash bcrypt de `DEMO_PASSWORD` |
| `accounts[].role` | `users.role` | `SOLICITANTE`, `COORDINADOR`, `BODEGA`, `AUDITOR` |
| `accounts[].organizationId` | `users.org_id` | |
| `requests[].requestId` | `requests.code` | `A-001`, `A-002`, `B-001` (identificador público) |
| `requests[].ownerLogin` | `requests.requester_id` | Se resuelve por `users.email` |
| `requests[].zona` | `requests.zone` | |
| `requests[].prioridad` | `requests.priority` | |
| `requests[].fechaRequerida` | `requests.required_date` | `timestamptz` en UTC |
| `requests[].observaciones` | `requests.notes` | Máximo 500 caracteres |
| `requests[].lines[].sku` / `quantity` | `request_lines.sku_id` / `quantity` | Un SKU por solicitud |
| `clockUtc` | Reloj inyectado en las pruebas | `2030-01-10T14:00:00Z` |

## Estructura del repositorio

```
apps/api/        API (R3 en adelante) y helper de pruebas
apps/web/        Interfaz web (R6)
contracts/       Contrato OpenAPI y esquema de salida de IA
docs/            ADR, diagramas, plan, tareas, actas de hito y anexos oficiales
evidence/        Trazabilidad, bitácora de IA, riesgos y resultados de pruebas
migrations/      SQL del esquema (idempotente)
seeds/           SQL de datos semilla
scripts/         Utilidades (base de datos, SPECS, trazabilidad)
specs/           Constitución y las cinco SPECS
tests/           unit, integration y e2e
```

## Reglas del equipo

- Nadie sube directo a `main` (salvo el primer commit del repositorio).
- No se une un PR sin 1 aprobación de una persona distinta del autor y sin CI en verde.
- Cada PR cita RF y AC, declara el uso de IA y lleva el trailer `Asistido-por-IA` si el contenido fue
  generado con asistencia.
- Los secretos viven solo en `.env`. Nunca en el repositorio, en PR ni en logs.
- Mensajes de commit: `tipo(alcance): resumen (RFxx, AC-xxx)`.
