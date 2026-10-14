// Ejecuta un script de Python con el interprete que haya (python3, python o py -3).
// Sirve igual en Git Bash, PowerShell, Linux y CI.
//   node scripts/py.mjs scripts/export_specs.py --check
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Uso: node scripts/py.mjs <script.py> [argumentos]');
  process.exit(1);
}

const candidatos = [
  ['python3', []],
  ['python', []],
  ['py', ['-3']],
];
for (const [cmd, previos] of candidatos) {
  const r = spawnSync(cmd, [...previos, ...args], { stdio: 'inherit' });
  if (r.error && r.error.code === 'ENOENT') continue;
  process.exit(r.status ?? 1);
}
console.error('FALLO: no se encontro Python 3 (se probo python3, python y py -3).');
process.exit(1);
