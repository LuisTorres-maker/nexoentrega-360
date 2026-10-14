// SOLO LECTURA. Conecta a DATABASE_URL y resume el estado de la base.
// No imprime la URL ni la clave. No escribe nada.
//   node scripts/db-check.mjs              revision completa (exit 2 si falta algo)
//   node scripts/db-check.mjs --conexion   solo prueba la conexion y muestra la version
import { AYUDA_CONEXION, configDesdeEntorno, crearPool, limpiarMensaje } from './lib/env.mjs';

const SOLO_CONEXION = process.argv.includes('--conexion');
const TABLAS_ESPERADAS = [
  'organizations',
  'users',
  'sessions',
  'skus',
  'inventory',
  'requests',
  'request_lines',
  'audit_events',
  'idempotency_keys',
  'ai_summary_attempts',
  'schema_migrations',
];
// Lista cerrada en el codigo: nunca se arma SQL con texto externo.
const TABLAS_CON_CONTEO = ['organizations', 'users', 'skus', 'inventory', 'requests'];

const cfg = configDesdeEntorno('DATABASE_URL');
if (!cfg.url) {
  console.error('FALLO: DATABASE_URL no esta definida (cree el archivo .env).');
  process.exit(1);
}

const pool = crearPool(cfg);
let salida = 0;
try {
  const client = await pool.connect();
  try {
    await client.query('SET default_transaction_read_only = on');
    const v = await client.query('SHOW server_version');
    const ssl = await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
    console.log('Conexion: OK');
    console.log(`Version de PostgreSQL: ${v.rows[0].server_version}`);
    console.log(`Conexion cifrada (SSL): ${ssl.rows[0]?.ssl ? 'si' : 'no'}`);
    if (SOLO_CONEXION) process.exit(0);

    const tablas = await client.query(
      `SELECT c.relname AS tabla, c.relrowsecurity AS rls
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname`,
    );
    const existentes = new Map(tablas.rows.map((r) => [r.tabla, r.rls]));
    console.log('\nTablas del esquema public (RLS = seguridad por filas):');
    if (tablas.rows.length === 0) console.log('  (ninguna)');
    for (const r of tablas.rows)
      console.log(`  ${r.tabla.padEnd(22)} RLS=${r.rls ? 'activo' : 'NO'}`);

    const faltan = TABLAS_ESPERADAS.filter((t) => !existentes.has(t));
    const sinRls = TABLAS_ESPERADAS.filter((t) => existentes.has(t) && !existentes.get(t));

    if (existentes.has('schema_migrations')) {
      const m = await client.query('SELECT name, applied_at FROM schema_migrations ORDER BY name');
      console.log('\nMigraciones registradas:');
      if (m.rows.length === 0) console.log('  (ninguna)');
      for (const r of m.rows) console.log(`  ${r.name}  (${new Date(r.applied_at).toISOString()})`);
    }

    console.log('\nConteos:');
    for (const t of TABLAS_CON_CONTEO) {
      if (!existentes.has(t)) {
        console.log(`  ${t.padEnd(14)} (no existe)`);
        continue;
      }
      const c = await client.query(`SELECT count(*)::int AS n FROM public.${t}`);
      console.log(`  ${t.padEnd(14)} ${c.rows[0].n}`);
    }

    console.log('');
    if (faltan.length) {
      console.log(`FALTAN TABLAS: ${faltan.join(', ')}`);
      salida = 2;
    }
    if (sinRls.length) {
      console.log(`SIN RLS: ${sinRls.join(', ')}`);
      salida = 2;
    }
    if (salida === 0) console.log('Esquema completo y con RLS activo.');
    else console.log('El esquema no esta completo (esperable antes de aplicar las migraciones).');
  } finally {
    client.release();
  }
} catch (err) {
  // Algunos errores de red llegan sin codigo (timeout) o dentro de un AggregateError.
  const mensaje = String(err?.message ?? '');
  const codigo =
    err?.code ??
    err?.errors?.find((e) => e?.code)?.code ??
    (/timeout/i.test(mensaje) ? 'ETIMEDOUT' : 'SIN_CODIGO');
  console.error(`FALLO de conexion o consulta. Codigo: ${codigo}`);
  console.error(`Detalle: ${limpiarMensaje(mensaje, cfg.url)}`);
  if (AYUDA_CONEXION[codigo]) console.error(`Pista: ${AYUDA_CONEXION[codigo]}`);
  salida = 1;
} finally {
  await pool.end().catch(() => {});
}
process.exit(salida);
