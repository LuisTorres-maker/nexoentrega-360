// RNF01 (contrato). Cada ruta registrada en Express existe en contracts/openapi.yaml y viceversa.
// Sin base de datos: la app se construye con un pool falso porque solo se leen sus rutas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app';
import { RAIZ } from '../helpers/db';

interface CapaExpress {
  route?: { path: string; methods: Record<string, boolean> };
}

function rutasDeExpress(): string[] {
  const app = createApp({ pool: {} as never, logger: pino({ level: 'silent' }) });
  const pila = (app as unknown as { _router: { stack: CapaExpress[] } })._router.stack;
  const rutas: string[] = [];
  for (const capa of pila) {
    if (!capa.route) continue;
    for (const metodo of Object.keys(capa.route.methods)) {
      rutas.push(`${metodo.toUpperCase()} ${capa.route.path.replace(/:([A-Za-z]+)/g, '{$1}')}`);
    }
  }
  return rutas.sort();
}

function rutasDeOpenApi(): string[] {
  const texto = readFileSync(join(RAIZ, 'contracts', 'openapi.yaml'), 'utf8');
  const seccion = texto.slice(texto.indexOf('\npaths:'), texto.indexOf('\ncomponents:'));
  const rutas: string[] = [];
  let actual = '';
  for (const linea of seccion.split('\n')) {
    const p = /^ {2}(\/[^\s:]*):\s*$/.exec(linea);
    if (p) {
      actual = p[1]!;
      continue;
    }
    const m = /^ {4}(get|post|put|patch|delete):\s*$/.exec(linea);
    if (m && actual) rutas.push(`${m[1]!.toUpperCase()} ${actual}`);
  }
  return rutas.sort();
}

describe('contrato HTTP', () => {
  it('cada ruta de Express esta en openapi.yaml y cada ruta del contrato esta registrada', () => {
    const enExpress = rutasDeExpress();
    const enContrato = rutasDeOpenApi();
    expect(enContrato.length).toBeGreaterThan(15);
    expect(enExpress).toEqual(enContrato);
  });
});
