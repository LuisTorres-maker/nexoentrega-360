// Ejecuta un script npm (typecheck o build) en cada workspace que ya tenga su codigo.
// Permite que el CI pase en cada PR de la publicacion por olas: un workspace sin tsconfig.json
// (por ejemplo apps/web antes de su PR) se omite con un aviso en vez de fallar.
//   node scripts/workspaces.mjs typecheck
//   node scripts/workspaces.mjs build
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const WORKSPACES = ['apps/api', 'apps/web'];
const script = process.argv[2];
if (!script) {
  console.error('Uso: node scripts/workspaces.mjs <typecheck|build>');
  process.exit(2);
}

let fallo = 0;
for (const ws of WORKSPACES) {
  const dir = join(RAIZ, ws);
  const pkgRuta = join(dir, 'package.json');
  if (!existsSync(pkgRuta)) continue;
  const pkg = JSON.parse(readFileSync(pkgRuta, 'utf8'));
  if (!pkg.scripts?.[script]) {
    console.log(`[${ws}] sin script "${script}": omitido`);
    continue;
  }
  if (!existsSync(join(dir, 'tsconfig.json'))) {
    console.log(`[${ws}] sin tsconfig.json todavia: "${script}" omitido`);
    continue;
  }
  console.log(`[${ws}] npm run ${script}`);
  const r = spawnSync('npm', ['run', script, '-w', ws], {
    cwd: RAIZ,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) fallo = r.status ?? 1;
}
process.exit(fallo);
