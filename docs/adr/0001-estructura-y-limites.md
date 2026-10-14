# ADR 0001 Estructura y límites

Estado: propuesto
Fecha y versión: 2026-10-14 / v1

## Contexto y restricciones

NexoEntrega 360 debe entregar un recorrido completo (identidad, solicitud, reserva, despacho, entrega, auditoría) en **un día de trabajo**
con seis personas. El enunciado permite un **monolito modular** y no da puntos por microservicios, hosting público ni extras.
Restricciones que pesan en la estructura: RF02 y RNF01 (aislamiento y autorización en el servidor), RNF02 (transacciones verificadas contra
una base real), RNF04 (clon limpio en 15 minutos con un comando), RNF06 (CI sin servicios de pago) y la decisión de usar Supabase como
base de la demostración del equipo.

## Alternativas consideradas

1. **Microservicios** (identidad, inventario, IA por separado).
   Ventajas: despliegue independiente. Desventajas: red, contratos y fallos parciales entre servicios que no aportan al caso; el inventario y
   la auditoría necesitan la **misma transacción**; costo de tiempo muy alto. Descartada por el enunciado y por el plazo.
2. **Un solo proyecto** (API y páginas en el mismo paquete).
   Ventajas: menos carpetas. Desventajas: mezcla la frontera de confianza del navegador con la del servidor y complica probar la API sola.
3. **Solo Supabase** (REST automática y políticas RLS, sin API propia).
   Ventajas: poco código de servidor. Desventajas: la reserva todo o nada con bloqueo, orden fijo de SKU, llaves de idempotencia y auditoría
   en la misma transacción no se expresa bien con la API REST; las pruebas de base real y el CI dependerían de un servicio externo.
4. **Monolito modular con dos aplicaciones y una base PostgreSQL** (API Node y web React, SQL directo con `pg`, sin ORM).

## Criterios de elección

Correctitud transaccional, aislamiento de responsabilidades, simplicidad para seis personas, facilidad de prueba con base real,
reproducibilidad sin credenciales (RNF04) y cumplimiento del enunciado.

## Decisión y justificación

Elegimos la **alternativa 4**:

- Carpetas `apps/api` (Express, capas `routes`, `services`, `domain`, `db`, `ai`, `security`) y `apps/web` (React y Vite), con **una** base PostgreSQL.
- Las reglas y las transacciones viven en el servidor; el navegador solo muestra y no decide permisos.
- La API se construye con una fábrica `createApp({ pool, aiProvider, clock })` para probarla con la base de pruebas, fixtures de IA y reloj controlado.
- **Base de datos en dos usos con las mismas migraciones SQL:**
  - *Demostración del equipo:* PostgreSQL alojado en Supabase (se conecta por la cadena `DATABASE_URL`; en redes sin IPv6 se usa *Session pooler*).
    La API no usa `supabase-js` ni la REST de Supabase. Cada migración activa RLS sin políticas y revoca permisos a `anon` y `authenticated`,
    de modo que la clave pública de Supabase no pueda leer ni escribir (RNF01).
  - *Pruebas y arranque reproducible:* PostgreSQL 16.4 local en Docker. Las pruebas vacían tablas y nunca corren contra Supabase
    (la guardia `assertSafeTestDb` lo impide). `docker compose up` no necesita Supabase ni credenciales.
- Identificador público de solicitud: su `code`; el `id` numérico no sale de la API.

## Consecuencias y riesgos

Positivas: una sola unidad de despliegue, transacciones simples, pruebas reales y reproducibilidad.
Riesgos: (a) la conexión directa de Supabase usa IPv6 y falló desde un computador del equipo (R14); (b) un proyecto gratuito de Supabase se pausa
por inactividad (R15); (c) el monolito acopla el despliegue de API y web, aceptable para este alcance.
Residual: bajo; la demo puede apoyarse en Docker si Supabase falla.

## RF y AC afectados

RF02, RF05, RF07, RNF01, RNF02, RNF04, RNF06 / AC-RNF04-01, AC-RNF04-02, AC-RNF04-03, AC-RNF01-04, AC-RNF02-03.

## Verificación de la decisión

Verificado en R2 (base): `tests/integration/db.test.ts` aplica migraciones y seed dos veces y comprueba restricciones y RLS en las 11 tablas
sobre PostgreSQL 16.4 local. `npm run db:check --conexion` conectó a Supabase (PostgreSQL 17.11) con la cadena *Session pooler*.
Pendiente (rondas siguientes): diagrama de contenedores contra las carpetas finales y `docker-compose.yml` completo (R7) y clon limpio cronometrado (R7).

## Autor y revisión humana

Autor: PENDIENTE (Luis). Revisor: PENDIENTE (Carlos B). Fecha UTC: PENDIENTE (Luis). Commit: PENDIENTE (Luis).
