// RNF04 AC-RNF04-03: versiones fijadas (dependencias exactas, Node en .nvmrc, imagenes con version).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../helpers/db';

const leerJson = (ruta: string) =>
  JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8')) as Record<string, unknown>;

describe('entrega reproducible', () => {
  it('AC-RNF04-03: ninguna dependencia usa rangos (^ o ~) y existen el candado y .nvmrc', () => {
    for (const ruta of ['package.json', 'apps/api/package.json', 'apps/web/package.json']) {
      const p = leerJson(ruta);
      for (const campo of ['dependencies', 'devDependencies']) {
        const deps = (p[campo] ?? {}) as Record<string, string>;
        for (const [nombre, version] of Object.entries(deps)) {
          expect(version, `${ruta} ${nombre}`).toMatch(/^\d+\.\d+\.\d+$/);
        }
      }
    }
    expect(existsSync(join(RAIZ, 'package-lock.json'))).toBe(true);
    expect(readFileSync(join(RAIZ, '.nvmrc'), 'utf8').trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('AC-RNF04-03: las imagenes de Docker usan una etiqueta de version concreta', () => {
    const compose = readFileSync(join(RAIZ, 'docker-compose.yml'), 'utf8');
    const imagenes = [...compose.matchAll(/image:\s*(\S+)/g)].map((m) => m[1]!);
    expect(imagenes.length).toBeGreaterThan(0);
    for (const img of imagenes) expect(img).toMatch(/:\d+\.\d+/);
  });
});
