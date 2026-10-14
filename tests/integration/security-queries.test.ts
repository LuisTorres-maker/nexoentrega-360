// RF02 AC-RF02-01..09 | RNF01 AC-RNF01-01..05 | RF08 AC-RF08-01..11 | RF09 AC-RF09-01..06
// Oraculos a mano: la frase "Dato exclusivo de ORG-B." nunca aparece en respuestas a ORG-A;
// ORG-A tiene 4 solicitudes (A-001..A-004) y ORG-B una (B-001).
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CUENTAS,
  crearEntorno,
  cuerpoValido,
  estadoDe,
  eventos,
  fotoInventario,
  inventario,
  reiniciar,
  sembrarSolicitud,
  type Entorno,
} from '../helpers/api';

const FRASE_B = 'Dato exclusivo de ORG-B.';
let e: Entorno;
let coord: string;
let bodega: string;
let sol: string;
let aud: string;

beforeAll(async () => {
  e = await crearEntorno();
});
afterAll(async () => {
  await e.cerrar();
});
beforeEach(async () => {
  await reiniciar(e);
  coord = await e.login(CUENTAS.coordA);
  bodega = await e.login(CUENTAS.bodegaA);
  sol = await e.login(CUENTAS.solA);
  aud = await e.login(CUENTAS.audA);
});

describe('aislamiento entre organizaciones (RF02)', () => {
  it('AC-RF02-01: leer B-001 desde ORG-A responde 404 sin la frase exclusiva', async () => {
    const r = await e.get(coord, '/requests/B-001');
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toContain(FRASE_B);
  });

  it('AC-RF02-02: reservar B-001 desde ORG-A responde 404 y no cambia nada de ORG-B', async () => {
    const antes = await inventario(e.pool, 'ORG-B', 'KIT-HIGIENE');
    const r = await e.post(coord, '/requests/B-001/reserve').set('Idempotency-Key', 'k-1');
    expect(r.status).toBe(404);
    expect(await estadoDe(e.pool, 'B-001')).toBe('ENVIADA');
    expect(await inventario(e.pool, 'ORG-B', 'KIT-HIGIENE')).toEqual(antes);
    expect(await eventos(e.pool)).toBe(0);
  });

  it('AC-RF02-03: despachar B-001 desde ORG-A responde 404 sin cambios', async () => {
    const r = await e.post(bodega, '/requests/B-001/dispatch');
    expect(r.status).toBe(404);
    expect(await estadoDe(e.pool, 'B-001')).toBe('ENVIADA');
  });

  it('AC-RF02-04: cancelar B-001 desde un solicitante de ORG-A responde 404', async () => {
    const r = await e.post(sol, '/requests/B-001/cancel');
    expect(r.status).toBe(404);
    expect(await estadoDe(e.pool, 'B-001')).toBe('ENVIADA');
  });

  it('AC-RF02-05: el listado de ORG-A tiene exactamente 4 solicitudes y ninguna de ORG-B', async () => {
    const r = await e.get(coord, '/requests');
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: { code: string }) => i.code).sort()).toEqual([
      'A-001',
      'A-002',
      'A-003',
      'A-004',
    ]);
    expect(JSON.stringify(r.body)).not.toContain('B-001');
  });

  it('AC-RF02-06: el inventario de ORG-B muestra sus cantidades y no las de ORG-A', async () => {
    const cb = await e.login(CUENTAS.coordB);
    const r = await e.get(cb, '/inventory');
    expect(r.status).toBe(200);
    const alimento = r.body.items.find((i: { sku: string }) => i.sku === 'KIT-ALIMENTO');
    expect(alimento).toMatchObject({ onHand: 4, reserved: 0, available: 4 });
  });

  it('AC-RF02-07: el auditor de ORG-B no ve eventos de ORG-A', async () => {
    await e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
    const ab = await e.login(CUENTAS.audB);
    const r = await e.get(ab, '/audit');
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(0);
    expect(r.body.items).toEqual([]);
  });

  it('AC-RF02-08: otro solicitante de la misma organizacion recibe 404 y no ve A-001 en su lista', async () => {
    const otro = await e.login(CUENTAS.sol2A);
    expect((await e.get(otro, '/requests/A-001')).status).toBe(404);
    const l = await e.get(otro, '/requests');
    expect(l.body.total).toBe(0);
    expect(JSON.stringify(l.body)).not.toContain('A-001');
  });

  it('AC-RF02-09: B-001 y un codigo inexistente dan el mismo cuerpo (salvo correlationId) sin filtrar datos', async () => {
    const a = await e.get(coord, '/requests/B-001');
    const b = await e.get(coord, '/requests/B-999');
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    const sinId = (cuerpo: Record<string, unknown>) => {
      const copia = { ...cuerpo };
      delete copia.correlationId;
      return copia;
    };
    expect(sinId(a.body)).toEqual(sinId(b.body));
    const todo = JSON.stringify([a.body, a.headers]);
    expect(todo).not.toContain(FRASE_B);
    expect(todo).not.toContain('CENTRO');
  });
});

describe('autorizacion y orden de controles (RNF01)', () => {
  it('AC-RNF01-01: el auditor no puede reservar A-001 (403) y nada cambia', async () => {
    const antes = await fotoInventario(e.pool);
    const r = await e.post(aud, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
    expect(r.status).toBe(403);
    expect(await estadoDe(e.pool, 'A-001')).toBe('ENVIADA');
    expect(await fotoInventario(e.pool)).toBe(antes);
  });

  it('AC-RNF01-02: los cuatro roles reciben 403 en cada operacion que no les corresponde', async () => {
    const operaciones: { ruta: string; metodo: 'post' | 'get'; permitidos: string[] }[] = [
      { ruta: '/requests/A-001/reserve', metodo: 'post', permitidos: ['coord'] },
      { ruta: '/requests/A-001/dispatch', metodo: 'post', permitidos: ['bodega'] },
      { ruta: '/requests/A-001/deliver', metodo: 'post', permitidos: ['coord'] },
      { ruta: '/requests/A-001/cancel', metodo: 'post', permitidos: ['sol'] },
      { ruta: '/requests/A-001/submit', metodo: 'post', permitidos: ['sol'] },
      { ruta: '/inventory', metodo: 'get', permitidos: ['coord', 'bodega', 'aud'] },
      { ruta: '/audit', metodo: 'get', permitidos: ['coord', 'aud'] },
    ];
    const roles: Record<string, string> = { coord, bodega, sol, aud };
    const antes = await fotoInventario(e.pool);
    for (const op of operaciones) {
      for (const [nombre, token] of Object.entries(roles)) {
        if (op.permitidos.includes(nombre)) continue;
        const t = op.metodo === 'get' ? e.get(token, op.ruta) : e.post(token, op.ruta);
        const r = await t.set('Idempotency-Key', 'k-x');
        expect(r.status, `${nombre} ${op.ruta}`).toBe(403);
      }
    }
    expect(await fotoInventario(e.pool)).toBe(antes);
    expect(await eventos(e.pool)).toBe(0);
  });

  it('AC-RNF01-03: X-Org-Id se ignora y un orgId en el cuerpo da 422', async () => {
    const ok = await e.post(sol, '/requests', cuerpoValido()).set('X-Org-Id', 'ORG-B');
    expect(ok.status).toBe(201);
    const f = await e.pool.query<{ org_id: string }>(
      'SELECT org_id FROM requests WHERE code = $1',
      [ok.body.code],
    );
    expect(f.rows[0]!.org_id).toBe('ORG-A');
    const extra = await e.post(sol, '/requests', cuerpoValido({ orgId: 'ORG-B' }));
    expect(extra.status).toBe(422);
  });

  it('AC-RNF01-04: dos lecturas y dos escrituras cruzadas se deniegan sin cambios', async () => {
    const fotoAntes = await fotoInventario(e.pool);
    const lecturaDetalle = await e.get(coord, '/requests/B-001');
    const inv = await e.get(coord, '/inventory');
    const reservar = await e.post(coord, '/requests/B-001/reserve').set('Idempotency-Key', 'k-1');
    const despachar = await e.post(bodega, '/requests/B-001/dispatch');
    expect(lecturaDetalle.status).toBe(404);
    expect(JSON.stringify(inv.body)).not.toContain(
      'KIT-HIGIENE","name":"Kit de higiene","onHand":5',
    );
    expect(inv.body.items.find((i: { sku: string }) => i.sku === 'KIT-HIGIENE').onHand).toBe(8);
    expect([reservar.status, despachar.status]).toEqual([404, 404]);
    expect(await estadoDe(e.pool, 'B-001')).toBe('ENVIADA');
    expect(await fotoInventario(e.pool)).toBe(fotoAntes);
  });

  it('AC-RNF01-05: sin sesion 401, solicitante 403 y coordinador de otra organizacion 404, en ese orden', async () => {
    const sin = await e.post(null, '/requests/B-001/reserve').set('Idempotency-Key', 'k-1');
    const comoSol = await e.post(sol, '/requests/B-001/reserve').set('Idempotency-Key', 'k-1');
    const comoCoord = await e.post(coord, '/requests/B-001/reserve').set('Idempotency-Key', 'k-1');
    expect([sin.status, comoSol.status, comoCoord.status]).toEqual([401, 403, 404]);
  });
});

describe('consultas y tablero (RF08)', () => {
  it('AC-RF08-01: el coordinador lista sus 4 solicitudes por fecha de creacion descendente', async () => {
    const r = await e.get(coord, '/requests');
    expect(r.status).toBe(200);
    expect([r.body.page, r.body.pageSize, r.body.total]).toEqual([1, 20, 4]);
    expect(r.body.items.map((i: { code: string }) => i.code)).toEqual([
      'A-004',
      'A-003',
      'A-002',
      'A-001',
    ]);
  });

  it('AC-RF08-02: paginacion con pageSize 1 y page 2', async () => {
    const p1 = await e.get(coord, '/requests', { pageSize: 1, page: 1 });
    const p2 = await e.get(coord, '/requests', { pageSize: 1, page: 2 });
    expect(p2.status).toBe(200);
    expect([p2.body.items.length, p2.body.total, p2.body.page, p2.body.pageSize]).toEqual([
      1, 4, 2, 1,
    ]);
    expect(p2.body.items[0].code).not.toBe(p1.body.items[0].code);
  });

  it('AC-RF08-03: pageSize 100 pasa; 101, 0 y page 0 dan 422', async () => {
    expect((await e.get(coord, '/requests', { pageSize: 100 })).status).toBe(200);
    for (const q of [{ pageSize: 101 }, { pageSize: 0 }, { page: 0 }]) {
      const r = await e.get(coord, '/requests', q);
      expect(r.status, JSON.stringify(q)).toBe(422);
      expect(r.body.error).toBe('VALIDACION');
    }
  });

  it('AC-RF08-04: filtros por estado, prioridad, zona y combinados', async () => {
    const codes = async (q: Record<string, string>) =>
      ((await e.get(coord, '/requests', q)).body.items as { code: string }[])
        .map((i) => i.code)
        .sort();
    expect(await codes({ status: 'ENVIADA' })).toEqual(['A-001', 'A-002']);
    expect(await codes({ priority: 'ALTA' })).toEqual(['A-001']);
    expect(await codes({ zone: 'SUR' })).toEqual(['A-002']);
    expect(await codes({ status: 'ENVIADA', priority: 'NORMAL', zone: 'SUR' })).toEqual(['A-002']);
  });

  it('AC-RF08-05: filtros con valores desconocidos dan 422', async () => {
    for (const q of [{ status: 'ABIERTA' }, { zone: 'ESTE' }, { priority: 'urgente' }]) {
      expect((await e.get(coord, '/requests', q)).status).toBe(422);
    }
  });

  it('AC-RF08-06: el solicitante ve sus 4 y el otro solicitante ve 0', async () => {
    const otro = await e.login(CUENTAS.sol2A);
    expect((await e.get(sol, '/requests')).body.total).toBe(4);
    const o = await e.get(otro, '/requests');
    expect([o.body.total, o.body.items]).toEqual([0, []]);
  });

  it('AC-RF08-07: tablero con el seed: BORRADOR 1, ENVIADA 2, CANCELADA 1 e inventario sin datos de ORG-B', async () => {
    const r = await e.get(coord, '/dashboard');
    expect(r.status).toBe(200);
    expect(r.body.byStatus).toEqual({
      BORRADOR: 1,
      ENVIADA: 2,
      RESERVADA: 0,
      DESPACHADA: 0,
      ENTREGADA: 0,
      CANCELADA: 1,
    });
    const a = r.body.inventory.find((i: { sku: string }) => i.sku === 'KIT-ALIMENTO');
    expect(a).toMatchObject({ onHand: 10, reserved: 0, available: 10 });
  });

  it('AC-RF08-08: tras reservar A-001 el tablero muestra RESERVADA 1 y 10/7/3', async () => {
    await e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
    const r = await e.get(coord, '/dashboard');
    expect([r.body.byStatus.ENVIADA, r.body.byStatus.RESERVADA]).toEqual([1, 1]);
    const a = r.body.inventory.find((i: { sku: string }) => i.sku === 'KIT-ALIMENTO');
    expect(a).toMatchObject({ onHand: 10, reserved: 7, available: 3 });
  });

  it('AC-RF08-09: el solicitante ve el tablero sin inventario y /inventory responde 403', async () => {
    const d = await e.get(sol, '/dashboard');
    expect(d.status).toBe(200);
    expect(d.body.inventory).toBeUndefined();
    expect(
      Object.values(d.body.byStatus as Record<string, number>).reduce((a, b) => a + b, 0),
    ).toBe(4);
    expect((await e.get(sol, '/inventory')).status).toBe(403);
  });

  it('AC-RF08-10: bodega ve el inventario de su organizacion con disponible y sin KIT-INACTIVO', async () => {
    const r = await e.get(bodega, '/inventory');
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: { sku: string }) => i.sku)).toEqual([
      'KIT-AGUA',
      'KIT-ALIMENTO',
      'KIT-HIGIENE',
    ]);
    for (const i of r.body.items as { onHand: number; reserved: number; available: number }[]) {
      expect(i.available).toBe(i.onHand - i.reserved);
    }
  });

  it('AC-RF08-11: detalle propio 200; inexistente y ajeno 404 con el mismo cuerpo', async () => {
    const ok = await e.get(coord, '/requests/A-001');
    expect(ok.status).toBe(200);
    expect(ok.body.lines).toEqual([{ sku: 'KIT-ALIMENTO', quantity: 7 }]);
    const a = await e.get(coord, '/requests/A-999');
    const b = await e.get(coord, '/requests/B-001');
    expect([a.status, b.status]).toEqual([404, 404]);
  });
});

describe('auditoria (RF09)', () => {
  it('AC-RF09-01: el evento guarda identidad, organizacion, recurso, accion, estados, fecha UTC y correlationId', async () => {
    const r = await e
      .post(coord, '/requests/A-001/reserve')
      .set('Idempotency-Key', 'k-1')
      .set('x-correlation-id', 'corr-0001');
    expect(r.status).toBe(200);
    const a = await e.get(aud, '/audit');
    expect(a.status).toBe(200);
    expect(a.body.items[0]).toMatchObject({
      orgId: 'ORG-A',
      resourceType: 'REQUEST',
      resourceId: 'A-001',
      action: 'RESERVAR',
      fromStatus: 'ENVIADA',
      toStatus: 'RESERVADA',
      correlationId: 'corr-0001',
      occurredAt: '2030-01-10T14:00:00.000Z',
    });
    const u = await e.pool.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [
      a.body.items[0].userId,
    ]);
    expect(u.rows[0]!.email).toBe(CUENTAS.coordA);
  });

  it('AC-RF09-02: las operaciones rechazadas no crean eventos', async () => {
    const antes = await eventos(e.pool);
    await e.post(coord, '/requests/A-003/reserve').set('Idempotency-Key', 'k-1'); // 409 estado
    await e.post(sol, '/requests/A-001/reserve').set('Idempotency-Key', 'k-2'); // 403
    await e.post(coord, '/requests/B-001/reserve').set('Idempotency-Key', 'k-3'); // 404
    await e.post(sol, '/requests', cuerpoValido({ lines: [{ sku: 'KIT-AGUA', quantity: 0 }] })); // 422
    expect(await eventos(e.pool)).toBe(antes);
  });

  it('AC-RF09-03: PUT, PATCH y DELETE sobre /audit no existen (404)', async () => {
    const llamar = (metodo: 'put' | 'patch' | 'delete', ruta: string) =>
      request(e.app)[metodo](ruta).set('Authorization', `Bearer ${aud}`);
    for (const metodo of ['put', 'patch', 'delete'] as const) {
      expect((await llamar(metodo, '/audit')).status, metodo).toBe(404);
    }
    expect((await llamar('delete', '/audit/1')).status).toBe(404);
  });

  it('AC-RF09-04: coordinador y auditor consultan su auditoria; bodega y solicitante reciben 403', async () => {
    await e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
    await e.post(coord, '/requests/A-002/reserve').set('Idempotency-Key', 'k-2'); // 409: sin evento
    for (const t of [coord, aud]) {
      const r = await e.get(t, '/audit');
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(1);
      expect(r.body.items.every((i: { orgId: string }) => i.orgId === 'ORG-A')).toBe(true);
    }
    expect((await e.get(bodega, '/audit')).status).toBe(403);
    expect((await e.get(sol, '/audit')).status).toBe(403);
  });

  it('AC-RF09-05: si falla la insercion de la auditoria, nada queda a medias', async () => {
    // El evento se inserta en la misma transaccion: se fuerza el fallo con una restriccion
    // que rechaza la accion RESERVAR y se comprueba que el estado y el inventario no cambian.
    await e.pool.query(
      `ALTER TABLE audit_events ADD CONSTRAINT prueba_sin_reservar CHECK (action <> 'RESERVAR') NOT VALID`,
    );
    try {
      const r = await e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
      expect(r.status).toBe(500);
      expect(await estadoDe(e.pool, 'A-001')).toBe('ENVIADA');
      expect(await inventario(e.pool, 'ORG-A', 'KIT-ALIMENTO')).toEqual({
        fisico: 10,
        reservado: 0,
        disponible: 10,
      });
      expect(await eventos(e.pool)).toBe(0);
    } finally {
      await e.pool.query('ALTER TABLE audit_events DROP CONSTRAINT prueba_sin_reservar');
    }
  });

  it('AC-RF09-06: crear y editar un borrador no genera eventos', async () => {
    const c = await e.post(sol, '/requests', cuerpoValido());
    await e.patch(sol, `/requests/${c.body.code}`, cuerpoValido({ zone: 'SUR' }));
    expect(await eventos(e.pool)).toBe(0);
  });
});

describe('datos de volumen para listados (RNF03, parte funcional)', () => {
  it('AC-RNF03-02 (parcial): el listado pagina 120 solicitudes y respeta el maximo de 100', async () => {
    for (let i = 1; i <= 120; i++) {
      await sembrarSolicitud(e.pool, {
        code: `V-${String(i).padStart(3, '0')}`,
        estado: 'ENVIADA',
        lines: [{ sku: 'KIT-AGUA', q: 1 }],
      });
    }
    const r = await e.get(coord, '/requests', { pageSize: 100 });
    expect([r.body.items.length, r.body.total]).toEqual([100, 124]);
  });
});
