// Reinicia los datos de la demo en la base LOCAL de Docker Compose antes de las pruebas E2E.
// Solo ejecuta seeds/000_reset_demo.sql dentro del contenedor `db` (nunca contra Supabase).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export default function globalSetup(): void {
  const raiz = resolve(__dirname, '..', '..');
  const sql = readFileSync(join(raiz, 'seeds', '000_reset_demo.sql'), 'utf8');
  try {
    execFileSync(
      'docker',
      ['compose', 'exec', '-T', 'db', 'psql', '-U', 'nexo', '-d', 'nexo', '-v', 'ON_ERROR_STOP=1'],
      { cwd: raiz, input: sql, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (e) {
    const detalle = (e as { stderr?: Buffer }).stderr?.toString() ?? String(e);
    throw new Error(
      `No se pudo reiniciar la base de Docker. ¿Ejecutó "npm run up"?
${detalle.slice(0, 400)}`,
      { cause: e },
    );
  }
}
