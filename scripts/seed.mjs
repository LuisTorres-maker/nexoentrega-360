// Aplica seeds/001_base.sql (idempotente) a la base indicada por DATABASE_URL.
// Con --carga aplica seeds/002_load.sql (2.000 solicitudes para la prueba de carga).
// Solo para bases LOCALES. Contra Supabase NO se ejecuta: el SQL se pega a mano.
// seeds/000_reset_demo.sql NO se ejecuta desde aqui: es solo para ejecucion manual.
//   Uso local:  DATABASE_URL=$TEST_DATABASE_URL npm run seed
//               DATABASE_URL=$TEST_DATABASE_URL npm run seed:load
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDesdeEntorno, crearPool, esSupabase, limpiarMensaje } from './lib/env.mjs';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const NOMBRE = process.argv.includes('--carga') ? '002_load.sql' : '001_base.sql';
const ARCHIVO = join(RAIZ, 'seeds', NOMBRE);

if (!existsSync(ARCHIVO)) {
  console.log(`No existe seeds/${NOMBRE} (se genera con npm run seed:gen).`);
  process.exit(0);
}

const cfg = configDesdeEntorno('DATABASE_URL');
if (!cfg.url) {
  console.error('FALLO: DATABASE_URL no esta definida.');
  process.exit(1);
}
if (esSupabase(cfg.url)) {
  console.error(
    'ABORTADO: DATABASE_URL apunta a Supabase. Aplique el SQL a mano en el SQL Editor.',
  );
  process.exit(1);
}

const pool = crearPool(cfg);
try {
  await pool.query(readFileSync(ARCHIVO, 'utf8'));
  console.log(`Seed aplicado: seeds/${NOMBRE}`);
} catch (err) {
  console.error(`FALLO al sembrar. Codigo: ${err?.code ?? 'SIN_CODIGO'}`);
  console.error(`Detalle: ${limpiarMensaje(err?.message, cfg.url)}`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
