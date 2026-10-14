// Prueba de carga de RNF03 contra la API de Docker Compose (base LOCAL, nunca Supabase).
//   npm run up        (antes: levanta db, api y web)
//   npm run load
// 1) aplica seeds/002_load.sql (2.000 solicitudes, idempotente) en el contenedor db;
// 2) corre k6 (imagen grafana/k6 fijada) con loadtest/listados.js;
// 3) escribe evidence/tests/k6-resumen.json y evidence/tests/carga.md con datos reales.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const K6 = 'grafana/k6:0.55.0';
const SALIDA = join(RAIZ, 'evidence', 'tests');
mkdirSync(SALIDA, { recursive: true });

if (existsSync(join(RAIZ, '.env'))) process.loadEnvFile(join(RAIZ, '.env'));
const clave = process.env.DEMO_PASSWORD;
if (!clave) {
  console.error('FALLO: defina DEMO_PASSWORD (la clave ficticia de demostracion).');
  process.exit(1);
}

function ejecutar(cmd, args, opciones = {}) {
  return execFileSync(cmd, args, {
    cwd: RAIZ,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opciones,
  });
}

// 1) seed de carga en la base de Docker
const sql = readFileSync(join(RAIZ, 'seeds', '002_load.sql'), 'utf8');
ejecutar(
  'docker',
  ['compose', 'exec', '-T', 'db', 'psql', '-U', 'nexo', '-d', 'nexo', '-v', 'ON_ERROR_STOP=1'],
  {
    input: sql,
  },
);
const filas = ejecutar('docker', [
  'compose',
  'exec',
  '-T',
  'db',
  'psql',
  '-U',
  'nexo',
  '-d',
  'nexo',
  '-At',
  '-c',
  'SELECT count(*) FROM requests',
]).trim();
console.log(`Solicitudes en la base de Docker: ${filas}`);

// 2) k6
const inicio = new Date();
const r = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '-i',
    '-v',
    `${join(RAIZ, 'loadtest')}:/scripts`,
    '-v',
    `${SALIDA}:/out`,
    '-e',
    'BASE_URL=http://host.docker.internal:3000',
    '-e',
    `DEMO_PASSWORD=${clave}`,
    K6,
    'run',
    '--summary-export=/out/k6-resumen.json',
    '/scripts/listados.js',
  ],
  { cwd: RAIZ, encoding: 'utf8' },
);
const fin = new Date();
const salidaK6 = `${r.stdout}\n${r.stderr}`.replace(clave, '<oculto>');
console.log(salidaK6.split('\n').slice(-40).join('\n'));

// 3) resultados reales
const resumen = JSON.parse(readFileSync(join(SALIDA, 'k6-resumen.json'), 'utf8'));
// k6 exporta setup_data (aqui: el token de sesion de la prueba). No debe quedar en el repositorio.
delete resumen.setup_data;
writeFileSync(
  join(SALIDA, 'k6-resumen.json'),
  JSON.stringify(resumen, null, 2) + String.fromCharCode(10),
  'utf8',
);
const m = resumen.metrics;
const duracion = m['http_req_duration{fase:medicion}'] ?? m.http_req_duration;
const fallos = m['http_req_failed{fase:medicion}'] ?? m.http_req_failed;
const p95 = duracion['p(95)'];
const tasaError = fallos.value ?? fallos.rate ?? 0;
const cumple = p95 <= 700 && tasaError < 0.01;
let sha = 'desconocido';
try {
  sha = ejecutar('git', ['rev-parse', 'HEAD']).trim();
} catch {
  // sin git
}
const cpu = os.cpus();
const version = (
  ejecutar('docker', ['run', '--rm', K6, 'version']).trim().split('\n')[0] ?? K6
).trim();
const md = `# Prueba de carga (RNF03)

- Fecha y hora UTC de inicio: ${inicio.toISOString()}
- Fecha y hora UTC de fin: ${fin.toISOString()}
- Commit (HEAD; el árbol puede tener cambios sin commit): \`${sha}\`
- Herramienta: ${version} (imagen \`${K6}\`)
- Hardware: ${cpu[0]?.model.trim()} · ${cpu.length} hilos · ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB de RAM · ${os.type()} ${os.release()}
- Entorno: API y PostgreSQL 16.4 en Docker Compose local (no Supabase)
- Datos: ${filas} solicitudes en la base (2.000 sembradas con \`seeds/002_load.sql\`)
- Escenario: 20 usuarios virtuales, 5 s de calentamiento y 60 s de medición; \`GET /requests?page=N&pageSize=50&status=ENVIADA\` y \`GET /dashboard\` como COORDINADOR de ORG-A; sin IA

## Resultado

| Métrica (fase de medición) | Valor | Umbral |
|---|---|---|
| p95 de duración (ms) | ${p95.toFixed(1)} | ≤ 700 |
| Mediana (ms) | ${duracion.med.toFixed(1)} | — |
| Promedio (ms) | ${duracion.avg.toFixed(1)} | — |
| Máximo (ms) | ${duracion.max.toFixed(1)} | — |
| Tasa de error | ${(tasaError * 100).toFixed(2)} % | < 1 % |

**Veredicto: ${cumple ? 'CUMPLE' : 'NO CUMPLE'}** el umbral de RNF03 en esta máquina.

Historial de todas las corridas (la variación es real): \`evidence/tests/carga-historial.csv\`.

Datos crudos de esta corrida: \`evidence/tests/k6-resumen.json\`. Reproducir: \`npm run up\` y \`npm run load\`.
`;
writeFileSync(join(SALIDA, 'carga.md'), md, 'utf8');

// Historial: cada corrida agrega una fila (no se sobrescribe). Sirve para ver la variacion real.
const historial = join(SALIDA, 'carga-historial.csv');
if (!existsSync(historial)) {
  writeFileSync(
    historial,
    'inicio_utc,p95_ms,tasa_error_pct,veredicto,solicitudes,commit' + String.fromCharCode(10),
    'utf8',
  );
}
appendFileSync(
  historial,
  [
    inicio.toISOString(),
    p95.toFixed(1),
    (tasaError * 100).toFixed(2),
    cumple ? 'CUMPLE' : 'NO CUMPLE',
    filas,
    sha,
  ].join(',') + String.fromCharCode(10),
  'utf8',
);
console.log(
  `\np95 = ${p95.toFixed(1)} ms; errores = ${(tasaError * 100).toFixed(2)} %; ${cumple ? 'CUMPLE' : 'NO CUMPLE'}`,
);
process.exit(cumple ? 0 : 1);
