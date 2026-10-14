// RF04 AC-RF04-09 AC-RF04-10 AC-RF04-11 | RF05 AC-RF05-01..06 | RF06 AC-RF06-01..05
// RF07 AC-RF07-01..09 | RNF02 AC-RNF02-04 AC-RNF02-05 (en concurrency.test.ts)
// Oraculos escritos a mano del caso (acceptance-oracles): A-001 = 7 de KIT-ALIMENTO, fisico 10.
//   reserva  -> fisico 10, reservado 7, disponible 3
//   cancelar -> fisico 10, reservado 0, disponible 10
//   despacho -> fisico  3, reservado 0, disponible  3
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CUENTAS,
  crearEntorno,
  estadoDe,
  eventos,
  inventario,
  llaves,
  reiniciar,
  sembrarSolicitud,
  type Entorno,
} from '../helpers/api';

let e: Entorno;
let coord: string;
let bodega: string;
let sol: string;

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
});

const reservar = (code: string, llave?: string, token = coord) => {
  const t = e.post(token, `/requests/${code}/reserve`);
  return llave === undefined ? t : t.set('Idempotency-Key', llave);
};
const alimento = () => inventario(e.pool, 'ORG-A', 'KIT-ALIMENTO');

describe('reserva (RF05)', () => {
  it('AC-RF05-01: reservar A-001 deja fisico 10, reservado 7, disponible 3 y un evento RESERVAR', async () => {
    const r = await reservar('A-001', 'k-1');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('RESERVADA');
    expect(await estadoDe(e.pool, 'A-001')).toBe('RESERVADA');
    expect(await alimento()).toEqual({ fisico: 10, reservado: 7, disponible: 3 });
    expect(await eventos(e.pool, 'RESERVAR')).toBe(1);
  });

  it('AC-RF05-02: una linea suficiente y otra insuficiente: 409, nada cambia y no se guarda la llave', async () => {
    await sembrarSolicitud(e.pool, {
      code: 'A-900',
      lines: [
        { sku: 'KIT-AGUA', q: 2 },
        { sku: 'KIT-ALIMENTO', q: 11 },
      ],
    });
    const r = await reservar('A-900', 'k-2');
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('STOCK_INSUFICIENTE');
    expect(await inventario(e.pool, 'ORG-A', 'KIT-AGUA')).toEqual({
      fisico: 20,
      reservado: 0,
      disponible: 20,
    });
    expect(await alimento()).toEqual({ fisico: 10, reservado: 0, disponible: 10 });
    expect(await estadoDe(e.pool, 'A-900')).toBe('ENVIADA');
    expect(await eventos(e.pool)).toBe(0);
    expect(await llaves(e.pool)).toBe(0);
  });

  it('AC-RF05-03: reservar un BORRADOR responde 409 y no cambia nada', async () => {
    const antes = await alimento();
    const r = await reservar('A-003', 'k-3');
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('ESTADO_INVALIDO');
    expect(await estadoDe(e.pool, 'A-003')).toBe('BORRADOR');
    expect(await alimento()).toEqual(antes);
  });

  it('AC-RF05-04: reservar otra vez con otra llave responde 409 y hay un solo evento', async () => {
    expect((await reservar('A-001', 'k-1')).status).toBe(200);
    const r = await reservar('A-001', 'k-2');
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('ESTADO_INVALIDO');
    expect((await alimento()).reservado).toBe(7);
    expect(await eventos(e.pool, 'RESERVAR')).toBe(1);
  });

  it('AC-RF05-05: SKU activo sin fila de inventario cuenta como 0: 409 y no se crea fila', async () => {
    await e.pool.query(
      "INSERT INTO skus (code, name, active) VALUES ('KIT-NUEVO', 'Kit nuevo', TRUE)",
    );
    await sembrarSolicitud(e.pool, { code: 'A-901', lines: [{ sku: 'KIT-NUEVO', q: 1 }] });
    const filas = (await e.pool.query('SELECT count(*)::int AS n FROM inventory')).rows[0].n;
    const r = await reservar('A-901', 'k-5');
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('STOCK_INSUFICIENTE');
    expect((await e.pool.query('SELECT count(*)::int AS n FROM inventory')).rows[0].n).toBe(filas);
    expect(await eventos(e.pool)).toBe(0);
  });

  it('AC-RF05-06: con disponible 3 la solicitud de 3 gana (disponible 0) y la de 1 recibe 409', async () => {
    await reservar('A-001', 'k-1');
    await sembrarSolicitud(e.pool, { code: 'A-902', lines: [{ sku: 'KIT-ALIMENTO', q: 3 }] });
    await sembrarSolicitud(e.pool, { code: 'A-903', lines: [{ sku: 'KIT-ALIMENTO', q: 1 }] });
    expect((await reservar('A-902', 'k-6')).status).toBe(200);
    expect(await alimento()).toEqual({ fisico: 10, reservado: 10, disponible: 0 });
    const r = await reservar('A-903', 'k-7');
    expect(r.status).toBe(409);
    expect(await alimento()).toEqual({ fisico: 10, reservado: 10, disponible: 0 });
  });
});

describe('cancelar, despachar y entregar (RF06)', () => {
  beforeEach(async () => {
    await reservar('A-001', 'k-1');
  });

  it('AC-RF06-01: el dueno cancela A-001 RESERVADA: fisico 10, reservado 0, disponible 10', async () => {
    const r = await e.post(sol, '/requests/A-001/cancel');
    expect(r.status).toBe(200);
    expect(await estadoDe(e.pool, 'A-001')).toBe('CANCELADA');
    expect(await alimento()).toEqual({ fisico: 10, reservado: 0, disponible: 10 });
    expect(await eventos(e.pool, 'CANCELAR')).toBe(1);
  });

  it('AC-RF06-02: bodega despacha A-001: fisico 3, reservado 0, disponible 3', async () => {
    const r = await e.post(bodega, '/requests/A-001/dispatch');
    expect(r.status).toBe(200);
    expect(await estadoDe(e.pool, 'A-001')).toBe('DESPACHADA');
    expect(await alimento()).toEqual({ fisico: 3, reservado: 0, disponible: 3 });
    expect(await eventos(e.pool, 'DESPACHAR')).toBe(1);
  });

  it('AC-RF06-03: entregar A-001 DESPACHADA no cambia el inventario', async () => {
    await e.post(bodega, '/requests/A-001/dispatch');
    const r = await e.post(coord, '/requests/A-001/deliver');
    expect(r.status).toBe(200);
    expect(await estadoDe(e.pool, 'A-001')).toBe('ENTREGADA');
    expect(await alimento()).toEqual({ fisico: 3, reservado: 0, disponible: 3 });
    expect(await eventos(e.pool, 'ENTREGAR')).toBe(1);
  });

  it('AC-RF06-05: cancelar una DESPACHADA responde 409 y el inventario sigue en 3/0', async () => {
    await e.post(bodega, '/requests/A-001/dispatch');
    const r = await e.post(sol, '/requests/A-001/cancel');
    expect(r.status).toBe(409);
    expect(await estadoDe(e.pool, 'A-001')).toBe('DESPACHADA');
    expect(await alimento()).toEqual({ fisico: 3, reservado: 0, disponible: 3 });
  });

  it('AC-RF04-11: reservar, despachar y entregar dejan RESERVADA, DESPACHADA y ENTREGADA con 3 eventos en orden', async () => {
    await e.post(bodega, '/requests/A-001/dispatch');
    await e.post(coord, '/requests/A-001/deliver');
    expect(await estadoDe(e.pool, 'A-001')).toBe('ENTREGADA');
    expect(await alimento()).toEqual({ fisico: 3, reservado: 0, disponible: 3 });
    const ev = await e.pool.query<{ action: string }>(
      'SELECT action FROM audit_events ORDER BY id',
    );
    expect(ev.rows.map((f) => f.action)).toEqual(['RESERVAR', 'DESPACHAR', 'ENTREGAR']);
  });
});

describe('cancelar una ENVIADA y transiciones invalidas', () => {
  it('AC-RF06-04: cancelar A-002 ENVIADA no cambia el inventario', async () => {
    const r = await e.post(sol, '/requests/A-002/cancel');
    expect(r.status).toBe(200);
    expect(await estadoDe(e.pool, 'A-002')).toBe('CANCELADA');
    expect(await alimento()).toEqual({ fisico: 10, reservado: 0, disponible: 10 });
  });

  it('AC-RF04-09: todas las transiciones no permitidas responden 409 sin cambios', async () => {
    const casos: { estado: string; ruta: string; quien: () => string }[] = [
      { estado: 'ENVIADA', ruta: 'dispatch', quien: () => bodega },
      { estado: 'ENVIADA', ruta: 'deliver', quien: () => coord },
      { estado: 'RESERVADA', ruta: 'deliver', quien: () => coord },
      { estado: 'RESERVADA', ruta: 'reserve', quien: () => coord },
      { estado: 'DESPACHADA', ruta: 'reserve', quien: () => coord },
      { estado: 'DESPACHADA', ruta: 'cancel', quien: () => sol },
      { estado: 'ENTREGADA', ruta: 'dispatch', quien: () => bodega },
      { estado: 'ENTREGADA', ruta: 'cancel', quien: () => sol },
      { estado: 'CANCELADA', ruta: 'cancel', quien: () => sol },
      { estado: 'CANCELADA', ruta: 'reserve', quien: () => coord },
      { estado: 'BORRADOR', ruta: 'cancel', quien: () => sol },
      { estado: 'ENVIADA', ruta: 'submit', quien: () => sol },
    ];
    let n = 0;
    for (const c of casos) {
      const code = `M-${++n}`;
      await sembrarSolicitud(e.pool, {
        code,
        estado: c.estado,
        lines: [{ sku: 'KIT-AGUA', q: 1 }],
      });
      const antes = await inventario(e.pool, 'ORG-A', 'KIT-AGUA');
      const eventosAntes = await eventos(e.pool);
      const t = e.post(c.quien(), `/requests/${code}/${c.ruta}`);
      const r = c.ruta === 'reserve' ? await t.set('Idempotency-Key', `m-${n}`) : await t;
      expect(r.status, `${c.estado} -> ${c.ruta}`).toBe(409);
      expect(r.body.error).toBe('ESTADO_INVALIDO');
      expect(await estadoDe(e.pool, code)).toBe(c.estado);
      expect(await inventario(e.pool, 'ORG-A', 'KIT-AGUA')).toEqual(antes);
      expect(await eventos(e.pool)).toBe(eventosAntes);
    }
  });

  it('AC-RF04-10: cada rol recibe 403 en las operaciones que no le corresponden', async () => {
    const aud = await e.login(CUENTAS.audA);
    await reservar('A-001', 'k-1'); // A-001 RESERVADA
    const sinPermiso: [string, string, string, boolean][] = [
      [coord, 'A-001', 'dispatch', false],
      [bodega, 'A-002', 'reserve', true],
      [bodega, 'A-001', 'deliver', false],
      [aud, 'A-002', 'reserve', true],
      [sol, 'A-001', 'dispatch', false],
    ];
    const antes = await alimento();
    const ev = await eventos(e.pool);
    for (const [token, code, ruta, conLlave] of sinPermiso) {
      const t = e.post(token, `/requests/${code}/${ruta}`);
      const r = conLlave ? await t.set('Idempotency-Key', 'x') : await t;
      expect(r.status, `${ruta}`).toBe(403);
      expect(r.body.error).toBe('PROHIBIDO');
    }
    expect(await alimento()).toEqual(antes);
    expect(await eventos(e.pool)).toBe(ev);
    expect(await estadoDe(e.pool, 'A-002')).toBe('ENVIADA');
  });
});

describe('idempotencia (RF07)', () => {
  it('AC-RF07-01: repetir con la misma llave devuelve lo mismo con un solo efecto', async () => {
    const a = await reservar('A-001', 'K');
    const b = await reservar('A-001', 'K');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(b.headers['idempotent-replay']).toBe('true');
    expect(a.headers['idempotent-replay']).toBeUndefined();
    expect((await alimento()).reservado).toBe(7);
    expect(await eventos(e.pool, 'RESERVAR')).toBe(1);
  });

  it('AC-RF07-02: la misma llave con otra solicitud responde 409 y no cambia nada', async () => {
    await reservar('A-001', 'K');
    const r = await reservar('A-002', 'K');
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('LLAVE_CON_OTRO_CONTENIDO');
    expect(await estadoDe(e.pool, 'A-002')).toBe('ENVIADA');
    expect((await alimento()).reservado).toBe(7);
  });

  it('AC-RF07-03: sin encabezado o con encabezado vacio responde 400 LLAVE_REQUERIDA', async () => {
    const sin = await reservar('A-001');
    const vacio = await e.post(coord, '/requests/A-001/reserve').set('Idempotency-Key', '');
    for (const r of [sin, vacio]) {
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('LLAVE_REQUERIDA');
    }
    expect(await estadoDe(e.pool, 'A-001')).toBe('ENVIADA');
    expect((await alimento()).reservado).toBe(0);
  });

  it('AC-RF07-04: la misma llave de otra organizacion no devuelve la respuesta ajena', async () => {
    await reservar('A-001', 'K');
    const coordB = await e.login(CUENTAS.coordB);
    const r = await e.post(coordB, '/requests/B-001/reserve').set('Idempotency-Key', 'K');
    expect(r.status).toBe(200);
    expect(r.body.code).toBe('B-001');
    expect(r.headers['idempotent-replay']).toBeUndefined();
    expect(await inventario(e.pool, 'ORG-B', 'KIT-HIGIENE')).toEqual({
      fisico: 5,
      reservado: 2,
      disponible: 3,
    });
  });

  it('AC-RF07-05: un error no se guarda: con stock liberado la misma llave funciona', async () => {
    await reservar('A-001', 'k-0'); // disponible 3
    await sembrarSolicitud(e.pool, { code: 'A-904', lines: [{ sku: 'KIT-ALIMENTO', q: 5 }] });
    const falla = await reservar('A-904', 'K');
    expect(falla.status).toBe(409);
    expect(await llaves(e.pool)).toBe(1);
    await e.post(sol, '/requests/A-001/cancel'); // libera 7
    const ok = await reservar('A-904', 'K');
    expect(ok.status).toBe(200);
    expect((await alimento()).reservado).toBe(5);
    expect(await eventos(e.pool, 'RESERVAR')).toBe(2);
  });

  it('AC-RF07-06: dentro de 24 h se repite y pasadas 24 h la llave es nueva', async () => {
    const ok = await reservar('A-001', 'K');
    expect(ok.status).toBe(200);
    e.reloj.ahora = new Date('2030-01-11T13:59:59Z');
    coord = await e.login(CUENTAS.coordA); // la sesion de 8 h anterior ya vencio
    const dentro = await reservar('A-001', 'K');
    expect(dentro.status).toBe(200);
    expect(dentro.headers['idempotent-replay']).toBe('true');
    e.reloj.ahora = new Date('2030-01-11T14:00:01Z');
    sol = await e.login(CUENTAS.solA); // la sesion de 8 h ya vencio con el nuevo reloj
    coord = await e.login(CUENTAS.coordA);
    const fuera = await reservar('A-001', 'K');
    expect(fuera.status).toBe(409);
    expect(fuera.body.error).toBe('ESTADO_INVALIDO');
    expect(fuera.headers['idempotent-replay']).toBeUndefined();
  });

  it('AC-RF07-07: la respuesta guardada no se devuelve sin sesion ni a otro rol', async () => {
    await reservar('A-001', 'K');
    const sinSesion = await reservar('A-001', 'K', '');
    expect(sinSesion.status).toBe(401);
    const comoSolicitante = await reservar('A-001', 'K', sol);
    expect(comoSolicitante.status).toBe(403);
  });

  it('AC-RF07-08: un fallo antes del commit no deja reserva parcial, evento ni llave', async () => {
    await sembrarSolicitud(e.pool, {
      code: 'A-905',
      lines: [
        { sku: 'KIT-AGUA', q: 2 },
        { sku: 'KIT-ALIMENTO', q: 3 },
      ],
    });
    e.ganchos.despuesDeLineaReservada = (i) => {
      if (i === 0) throw new Error('fallo inyectado');
    };
    const r = await reservar('A-905', 'K');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('ERROR_INTERNO');
    expect(JSON.stringify(r.body)).not.toContain('fallo inyectado');
    expect(await inventario(e.pool, 'ORG-A', 'KIT-AGUA')).toEqual({
      fisico: 20,
      reservado: 0,
      disponible: 20,
    });
    expect(await alimento()).toEqual({ fisico: 10, reservado: 0, disponible: 10 });
    expect(await estadoDe(e.pool, 'A-905')).toBe('ENVIADA');
    expect(await eventos(e.pool)).toBe(0);
    expect(await llaves(e.pool)).toBe(0);
  });

  it('AC-RF07-09: dos peticiones simultaneas con la misma llave responden 200 y aplican un solo efecto', async () => {
    const [a, b] = await Promise.all([reservar('A-001', 'K'), reservar('A-001', 'K')]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await alimento()).reservado).toBe(7);
    expect(await eventos(e.pool, 'RESERVAR')).toBe(1);
  });
});
