// Ayudas para las pruebas con base real. SOLO usan TEST_DATABASE_URL (Postgres local).
// La guardia assertSafeTestDb aborta si la URL es de Supabase o de un host que no es local.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { assertSafeTestDb } from '../../apps/api/src/db/safe-test-db';

export const RAIZ = resolve(__dirname, '..', '..');
const URL_POR_DEFECTO = 'postgresql://nexo:test@localhost:54329/nexo_test';

export function urlDePruebas(): string {
  const url = process.env.TEST_DATABASE_URL?.trim() || URL_POR_DEFECTO;
  assertSafeTestDb(url, process.env.ALLOW_REMOTE_TEST_DB === '1');
  return url;
}

export function crearPoolDePruebas(): pg.Pool {
  return new pg.Pool({ connectionString: urlDePruebas(), max: 8 });
}

function leerSql(carpeta: string, archivo: string): string {
  return readFileSync(join(RAIZ, carpeta, archivo), 'utf8');
}

/** Aplica migrations/*.sql en orden. Es idempotente: se puede llamar varias veces. */
export async function migrar(pool: pg.Pool): Promise<string[]> {
  const archivos = readdirSync(join(RAIZ, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of archivos) await pool.query(leerSql('migrations', f));
  return archivos;
}

/** Aplica seeds/001_base.sql (idempotente). */
export async function sembrarBase(pool: pg.Pool): Promise<void> {
  await pool.query(leerSql('seeds', '001_base.sql'));
}

/** Deja la base en el estado inicial del caso: vacia las tablas de la aplicacion y siembra. */
export async function resetDb(pool: pg.Pool): Promise<void> {
  await pool.query(`TRUNCATE audit_events, idempotency_keys, ai_summary_attempts, request_lines,
    requests, inventory, sessions, users, skus, organizations RESTART IDENTITY CASCADE`);
  await pool.query('ALTER SEQUENCE request_code_seq RESTART WITH 1');
  await sembrarBase(pool);
}

/** Ejecuta una consulta que debe fallar y devuelve el codigo SQLSTATE y el mensaje. */
export async function codigoDeError(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = [],
): Promise<{ code: string; message: string }> {
  try {
    await pool.query(sql, params);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { code: err.code ?? 'SIN_CODIGO', message: err.message ?? '' };
  }
  throw new Error('La sentencia debio fallar y se ejecuto sin error');
}
