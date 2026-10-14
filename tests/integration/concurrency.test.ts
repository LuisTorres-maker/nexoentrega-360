// RNF02 AC-RNF02-01 AC-RNF02-02 AC-RNF02-04 AC-RNF02-05
// Oraculo del caso: A-001 y A-002 piden 7 de KIT-ALIMENTO cada una con fisico 10:
// exactamente una responde 200 y la otra 409; queda fisico 10, reservado 7, disponible 3.
// No se fija cual gana. Se repite 20 veces para detectar carreras.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CUENTAS,
  crearEntorno,
  estadoDe,
  eventos,
  inventario,
  reiniciar,
  sembrarSolicitud,
  type Entorno,
} from '../helpers/api';

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno();
});
afterAll(async () => {
  await e.cerrar();
});

describe('concurrencia (RNF02)', () => {
  it('AC-RNF02-01: A-001 y A-002 al mismo tiempo, 20 repeticiones: una gana y la otra 409', async () => {
    for (let i = 1; i <= 20; i++) {
      await reiniciar(e);
      const coord = await e.login(CUENTAS.coordA);
      const [r1, r2] = await Promise.all([
        e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', `a-${i}`),
        e.post(coord, '/requests/A-002/reserve').set('Idempotency-Key', `b-${i}`),
      ]);
      expect([r1.status, r2.status].sort(), `repeticion ${i}`).toEqual([200, 409]);
      expect(await inventario(e.pool, 'ORG-A', 'KIT-ALIMENTO'), `repeticion ${i}`).toEqual({
        fisico: 10,
        reservado: 7,
        disponible: 3,
      });
      const ganadora = r1.status === 200 ? 'A-001' : 'A-002';
      const perdedora = r1.status === 200 ? 'A-002' : 'A-001';
      expect(await estadoDe(e.pool, ganadora)).toBe('RESERVADA');
      expect(await estadoDe(e.pool, perdedora)).toBe('ENVIADA');
      expect(await eventos(e.pool, 'RESERVAR')).toBe(1);
    }
  }, 60_000);

  it('AC-RNF02-02: 15 solicitudes de 1 unidad con fisico 10: exactamente 10 ganan y 5 reciben 409', async () => {
    await reiniciar(e);
    for (let i = 1; i <= 15; i++) {
      await sembrarSolicitud(e.pool, { code: `C-${i}`, lines: [{ sku: 'KIT-ALIMENTO', q: 1 }] });
    }
    const coord = await e.login(CUENTAS.coordA);
    const res = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        e.post(coord, `/requests/C-${i + 1}/reserve`).set('Idempotency-Key', `c-${i + 1}`),
      ),
    );
    expect(res.filter((r) => r.status === 200)).toHaveLength(10);
    expect(res.filter((r) => r.status === 409)).toHaveLength(5);
    expect(res.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(await inventario(e.pool, 'ORG-A', 'KIT-ALIMENTO')).toEqual({
      fisico: 10,
      reservado: 10,
      disponible: 0,
    });
    expect(await eventos(e.pool, 'RESERVAR')).toBe(10);
  }, 30_000);

  it('AC-RNF02-04: dos despachos simultaneos de A-001: uno 200 y otro 409, con un solo evento', async () => {
    await reiniciar(e);
    const coord = await e.login(CUENTAS.coordA);
    const bodega = await e.login(CUENTAS.bodegaA);
    await e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
    const [a, b] = await Promise.all([
      e.post(bodega, '/requests/A-001/dispatch'),
      e.post(bodega, '/requests/A-001/dispatch'),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await inventario(e.pool, 'ORG-A', 'KIT-ALIMENTO')).toEqual({
      fisico: 3,
      reservado: 0,
      disponible: 3,
    });
    expect(await eventos(e.pool, 'DESPACHAR')).toBe(1);
  });

  it('AC-RNF02-05: cancelar y despachar A-001 a la vez: gana exactamente una, sin valores intermedios', async () => {
    for (let i = 0; i < 10; i++) {
      await reiniciar(e);
      const coord = await e.login(CUENTAS.coordA);
      const bodega = await e.login(CUENTAS.bodegaA);
      const sol = await e.login(CUENTAS.solA);
      await e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
      const [c, d] = await Promise.all([
        e.post(sol, '/requests/A-001/cancel'),
        e.post(bodega, '/requests/A-001/dispatch'),
      ]);
      expect([c.status, d.status].sort(), `repeticion ${i}`).toEqual([200, 409]);
      const inv = await inventario(e.pool, 'ORG-A', 'KIT-ALIMENTO');
      const estado = await estadoDe(e.pool, 'A-001');
      if (c.status === 200) {
        expect(estado).toBe('CANCELADA');
        expect(inv).toEqual({ fisico: 10, reservado: 0, disponible: 10 });
      } else {
        expect(estado).toBe('DESPACHADA');
        expect(inv).toEqual({ fisico: 3, reservado: 0, disponible: 3 });
      }
    }
  }, 60_000);
});
