// Levanta o apaga la base local de pruebas (servicio db-test de docker-compose.yml).
//   node scripts/db-test.mjs up     levanta Postgres en el puerto 54329 y espera a que este sano
//   node scripts/db-test.mjs down   la apaga (los datos de pruebas se pierden: es lo esperado)
import { spawnSync } from 'node:child_process';

const accion = process.argv[2];
const base = ['compose', '--profile', 'test'];
const comandos = {
  up: [...base, 'up', '-d', '--wait', 'db-test'],
  down: [...base, 'down', '--volumes', '--remove-orphans'],
};

if (!comandos[accion]) {
  console.error('Uso: node scripts/db-test.mjs up|down');
  process.exit(1);
}

const r = spawnSync('docker', comandos[accion], { stdio: 'inherit' });
if (r.error) {
  console.error(`FALLO: no se pudo ejecutar docker (${r.error.code ?? r.error.message}).`);
  console.error('Instale Docker Desktop o use un Postgres 16 local y ajuste TEST_DATABASE_URL.');
  process.exit(1);
}
if (r.status !== 0) {
  console.error(
    'FALLO: docker devolvio un error. Compruebe que Docker Desktop esta abierto y listo.',
  );
  process.exit(r.status ?? 1);
}
if (accion === 'up') {
  console.log('Base de pruebas lista en localhost:54329 (TEST_DATABASE_URL por defecto).');
}
