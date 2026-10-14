// Aplica migrations/*.sql, en orden de nombre, a la base indicada por DATABASE_URL.
// Solo para bases LOCALES (Docker o CI). Contra Supabase NO se ejecuta: el SQL se pega a mano
// en el SQL Editor (ver el runbook).
//   Uso local:  DATABASE_URL=$TEST_DATABASE_URL npm run migrate
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDesdeEntorno, crearPool, esSupabase, limpiarMensaje } from './lib/env.mjs';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIR = join(RAIZ, 'migrations');

const archivos = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();
if (archivos.length === 0) {
  console.log('No hay migraciones en migrations/ todavia (se crean en R2). Nada que aplicar.');
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
  for (const f of archivos) {
    await pool.query(readFileSync(join(DIR, f), 'utf8'));
    console.log(`Aplicada: ${f}`);
  }
  console.log('Migraciones completas.');
} catch (err) {
  console.error(`FALLO al migrar. Codigo: ${err?.code ?? 'SIN_CODIGO'}`);
  console.error(`Detalle: ${limpiarMensaje(err?.message, cfg.url)}`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
