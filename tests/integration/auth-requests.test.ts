// RF01 AC-RF01-01..09 | RNF01 AC-RNF01-06 | RF03 AC-RF03-01..13 | RF04 AC-RF04-01..08
// Oraculos a mano: el login devuelve un token y la base guarda solo su hash SHA-256 con 8 h;
// una solicitud invalida responde 422 con el campo y no crea nada.
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CLAVE,
  CUENTAS,
  crearEntorno,
  cuerpoValido,
  estadoDe,
  eventos,
  inventario,
  reiniciar,
  type Entorno,
} from '../helpers/api';

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno();
});
afterAll(async () => {
  await e.cerrar();
});
beforeEach(async () => {
  await reiniciar(e);
});

const total = async () =>
  (await e.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM requests')).rows[0]!.n;

describe('sesion (RF01)', () => {
  it('AC-RF01-01: login correcto devuelve token y la base guarda solo el hash con vencimiento de 8 h', async () => {
    const r = await request(e.app)
      .post('/auth/login')
      .send({ email: CUENTAS.coordA, password: CLAVE });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ role: 'COORDINADOR', orgId: 'ORG-A' });
    const token = r.body.token as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const s = await e.pool.query<{ token_hash: string; created_at: Date; expires_at: Date }>(
      'SELECT token_hash, created_at, expires_at FROM sessions',
    );
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]!.token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(s.rows[0]!.token_hash).not.toBe(token);
    expect(s.rows[0]!.expires_at.getTime() - s.rows[0]!.created_at.getTime()).toBe(8 * 3_600_000);
  });

  it('AC-RF01-02 y AC-RF01-03: clave erronea y cuenta inexistente dan el mismo 401 y no crean sesion', async () => {
    const mala = await request(e.app)
      .post('/auth/login')
      .send({ email: CUENTAS.coordA, password: 'incorrecta-1' });
    const nadie = await request(e.app)
      .post('/auth/login')
      .send({ email: 'nadie@example.test', password: 'x'.repeat(8) });
    expect(mala.status).toBe(401);
    expect(nadie.status).toBe(401);
    expect(mala.body.error).toBe('CREDENCIALES_INVALIDAS');
    const sinId = (b: Record<string, unknown>) => ({ ...b, correlationId: 'x' });
    expect(sinId(nadie.body)).toEqual(sinId(mala.body));
    expect((await e.pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0);
  });

  it('AC-RF01-04 y AC-RNF01-06: logout borra la sesion y GET /me no expone hashes', async () => {
    const t = await e.login(CUENTAS.coordA);
    const me = await e.get(t, '/me');
    expect(me.status).toBe(200);
    expect(Object.keys(me.body).sort()).toEqual(['displayName', 'email', 'id', 'orgId', 'role']);
    expect(JSON.stringify(me.body)).not.toContain(t);
    expect((await e.post(t, '/auth/logout')).status).toBe(200);
    expect((await e.pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0);
    const despues = await e.get(t, '/me');
    expect(despues.status).toBe(401);
    expect(despues.body.error).toBe('NO_AUTENTICADO');
  });

  it('AC-RF01-05: una sesion de 8 h deja de servir a las 8 h y 1 s', async () => {
    const t = await e.login(CUENTAS.coordA);
    e.reloj.ahora = new Date('2030-01-10T21:59:59Z');
    expect((await e.get(t, '/requests')).status).toBe(200);
    e.reloj.ahora = new Date('2030-01-10T22:00:01Z');
    const r = await e.get(t, '/requests');
    expect(r.status).toBe(401);
    expect(JSON.stringify(r.body)).not.toContain('A-001');
  });

  it('AC-RF01-06: sin encabezado, con token inventado y con Basic dan el mismo 401', async () => {
    const a = await request(e.app).get('/requests');
    const b = await request(e.app)
      .get('/requests')
      .set('Authorization', 'Bearer ' + 'a'.repeat(64));
    const c = await request(e.app).get('/requests').set('Authorization', 'Basic dXNlcjpjbGF2ZQ==');
    for (const r of [a, b, c]) {
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('NO_AUTENTICADO');
    }
  });

  it('AC-RF01-07 (base): las contrasenas estan como hash bcrypt y no aparecen en respuestas', async () => {
    const r = await request(e.app)
      .post('/auth/login')
      .send({ email: CUENTAS.solA, password: CLAVE });
    expect(JSON.stringify(r.body)).not.toContain(CLAVE);
    const h = await e.pool.query<{ password_hash: string }>('SELECT password_hash FROM users');
    expect(h.rows).toHaveLength(9);
    for (const f of h.rows) expect(f.password_hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('AC-RF01-08: login sin password o con password vacio responde 422 y no crea sesion', async () => {
    const a = await request(e.app).post('/auth/login').send({ email: CUENTAS.solA });
    const b = await request(e.app).post('/auth/login').send({ email: CUENTAS.solA, password: '' });
    for (const r of [a, b]) {
      expect(r.status).toBe(422);
      expect(r.body.error).toBe('VALIDACION');
      expect(r.body.campo).toBe('password');
    }
    expect((await e.pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0);
  });

  it('AC-RF01-09: un campo extra role en el login responde 422 y no crea sesion', async () => {
    const r = await request(e.app)
      .post('/auth/login')
      .send({ email: CUENTAS.solA, password: CLAVE, role: 'COORDINADOR' });
    expect(r.status).toBe(422);
    expect((await e.pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0);
  });
});

describe('validacion de solicitudes (RF03)', () => {
  let sol: string;
  beforeEach(async () => {
    sol = await e.login(CUENTAS.solA);
  });
  const crear = (cuerpo: object) => e.post(sol, '/requests', cuerpo);

  it('AC-RF03-01: un borrador valido responde 201 con code, BORRADOR, dueno y organizacion de la sesion', async () => {
    const antes = await total();
    const inv = await inventario(e.pool, 'ORG-A', 'KIT-AGUA');
    const r = await crear(
      cuerpoValido({
        lines: [
          { sku: 'KIT-AGUA', quantity: 2 },
          { sku: 'KIT-HIGIENE', quantity: 3 },
        ],
      }),
    );
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('BORRADOR');
    expect(r.body.code).toMatch(/^SOL-\d{6}$/);
    expect(await total()).toBe(antes + 1);
    const f = await e.pool.query<{ org_id: string; email: string }>(
      `SELECT r.org_id, u.email FROM requests r JOIN users u ON u.id = r.requester_id WHERE r.code = $1`,
      [r.body.code],
    );
    expect(f.rows[0]).toEqual({ org_id: 'ORG-A', email: CUENTAS.solA });
    expect(await inventario(e.pool, 'ORG-A', 'KIT-AGUA')).toEqual(inv);
    expect(await eventos(e.pool)).toBe(0);
  });

  it('AC-RF03-02: cantidad 0 responde 422 con campo lines.0.quantity y no crea solicitud', async () => {
    const antes = await total();
    const r = await crear(cuerpoValido({ lines: [{ sku: 'KIT-AGUA', quantity: 0 }] }));
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ error: 'VALIDACION', campo: 'lines.0.quantity' });
    expect(await total()).toBe(antes);
  });

  it('AC-RF03-03: -3, 2.5 y 501 dan 422; 1 y 500 dan 201', async () => {
    for (const q of [-3, 2.5, 501]) {
      const r = await crear(cuerpoValido({ lines: [{ sku: 'KIT-AGUA', quantity: q }] }));
      expect(r.status, `cantidad ${q}`).toBe(422);
      expect(r.body.campo).toBe('lines.0.quantity');
    }
    for (const q of [1, 500]) {
      const r = await crear(cuerpoValido({ lines: [{ sku: 'KIT-AGUA', quantity: q }] }));
      expect(r.status, `cantidad ${q}`).toBe(201);
    }
  });

  it('AC-RF03-04: SKU repetido responde 422 con campo lines', async () => {
    const r = await crear(
      cuerpoValido({
        lines: [
          { sku: 'KIT-AGUA', quantity: 1 },
          { sku: 'KIT-AGUA', quantity: 2 },
        ],
      }),
    );
    expect(r.status).toBe(422);
    expect(r.body.campo).toBe('lines');
  });

  it('AC-RF03-05: 0 y 11 lineas dan 422; 10 lineas distintas dan 201', async () => {
    await e.pool.query(
      `INSERT INTO skus (code, name, active) SELECT 'KIT-X' || g, 'Kit ' || g, TRUE FROM generate_series(1, 10) g`,
    );
    const lineas = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ sku: `KIT-X${i + 1}`, quantity: 1 }));
    expect((await crear(cuerpoValido({ lines: [] }))).status).toBe(422);
    expect(
      (await crear(cuerpoValido({ lines: [...lineas(10), { sku: 'KIT-AGUA', quantity: 1 }] })))
        .status,
    ).toBe(422);
    expect((await crear(cuerpoValido({ lines: lineas(10) }))).status).toBe(201);
  });

  it('AC-RF03-06: SKU inactivo o inexistente responde 422 con campo lines.0.sku', async () => {
    for (const sku of ['KIT-INACTIVO', 'KIT-NOEXISTE']) {
      const r = await crear(cuerpoValido({ lines: [{ sku, quantity: 1 }] }));
      expect(r.status, sku).toBe(422);
      expect(r.body.campo).toBe('lines.0.sku');
    }
  });

  it('AC-RF03-07: observaciones de 501 caracteres dan 422 y de 500 dan 201', async () => {
    const mal = await crear(cuerpoValido({ notes: 'x'.repeat(501) }));
    expect(mal.status).toBe(422);
    expect(mal.body.campo).toBe('notes');
    expect((await crear(cuerpoValido({ notes: 'x'.repeat(500) }))).status).toBe(201);
  });

  it('AC-RF03-08: zona y prioridad desconocidas dan 422 con su campo', async () => {
    const z = await crear(cuerpoValido({ zone: 'ESTE' }));
    const p = await crear(cuerpoValido({ priority: 'URGENTE' }));
    expect([z.status, z.body.campo]).toEqual([422, 'zone']);
    expect([p.status, p.body.campo]).toEqual([422, 'priority']);
  });

  it('AC-RF03-09: campos extra (status, code) dan 422 y el estado no se fija desde el cliente', async () => {
    const antes = await total();
    const r = await crear(cuerpoValido({ status: 'ENVIADA', code: 'A-900' }));
    expect(r.status).toBe(422);
    expect(await total()).toBe(antes);
  });

  it('AC-RF03-10: fecha pasada se guarda como borrador pero no se puede enviar (422 y sigue BORRADOR)', async () => {
    const r = await crear(cuerpoValido({ requiredDate: '2030-01-09T14:00:00Z' }));
    expect(r.status).toBe(201);
    const env = await e.post(sol, `/requests/${r.body.code}/submit`);
    expect(env.status).toBe(422);
    expect(env.body.campo).toBe('requiredDate');
    expect(await estadoDe(e.pool, r.body.code)).toBe('BORRADOR');
    expect(await eventos(e.pool, 'ENVIAR')).toBe(0);
  });

  it('AC-RF03-11: fecha igual al momento de envio se acepta', async () => {
    const r = await crear(cuerpoValido({ requiredDate: '2030-01-10T14:00:00Z' }));
    const env = await e.post(sol, `/requests/${r.body.code}/submit`);
    expect(env.status).toBe(200);
    expect(await estadoDe(e.pool, r.body.code)).toBe('ENVIADA');
  });

  it('AC-RF03-14: un SKU desactivado entre el borrador y el envio da 422 y la solicitud sigue BORRADOR', async () => {
    const r = await crear(cuerpoValido());
    expect(r.status).toBe(201);
    await e.pool.query("UPDATE skus SET active = FALSE WHERE code = 'KIT-AGUA'");
    const env = await e.post(sol, `/requests/${r.body.code}/submit`);
    expect(env.status).toBe(422);
    expect(env.body.campo).toBe('lines.0.sku');
    expect(await estadoDe(e.pool, r.body.code)).toBe('BORRADOR');
    expect(await eventos(e.pool, 'ENVIAR')).toBe(0);
    await e.pool.query("UPDATE skus SET active = TRUE WHERE code = 'KIT-AGUA'");
  });

  it('AC-RF03-12: un coordinador no puede crear solicitudes (403)', async () => {
    const c = await e.login(CUENTAS.coordA);
    const antes = await total();
    const r = await e.post(c, '/requests', cuerpoValido());
    expect(r.status).toBe(403);
    expect(await total()).toBe(antes);
  });

  it('AC-RF03-13: fecha con formato invalido da 422 y cuerpo que no es JSON da 400', async () => {
    const f = await crear(cuerpoValido({ requiredDate: '10/01/2030' }));
    expect([f.status, f.body.campo]).toEqual([422, 'requiredDate']);
    const j = await request(e.app)
      .post('/requests')
      .set('Authorization', `Bearer ${sol}`)
      .set('Content-Type', 'application/json')
      .send('{no es json');
    expect(j.status).toBe(400);
    expect(j.body.error).toBe('JSON_INVALIDO');
  });
});

describe('borrador, envio y cancelacion (RF04)', () => {
  let sol: string;
  beforeEach(async () => {
    sol = await e.login(CUENTAS.solA);
  });

  it('AC-RF04-01: el dueno edita A-003 y conserva code y estado', async () => {
    const r = await e.patch(
      sol,
      '/requests/A-003',
      cuerpoValido({ zone: 'SUR', lines: [{ sku: 'KIT-AGUA', quantity: 4 }] }),
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ code: 'A-003', status: 'BORRADOR', zone: 'SUR' });
    expect(r.body.lines).toEqual([{ sku: 'KIT-AGUA', quantity: 4 }]);
  });

  it('AC-RF04-02: editar una ENVIADA responde 409 y no cambia nada', async () => {
    const r = await e.patch(sol, '/requests/A-001', cuerpoValido({ zone: 'SUR' }));
    expect(r.status).toBe(409);
    const f = await e.pool.query<{ zone: string }>(
      "SELECT zone FROM requests WHERE code = 'A-001'",
    );
    expect(f.rows[0]!.zone).toBe('NORTE');
  });

  it('AC-RF04-03: enviar A-003 la deja ENVIADA con un evento ENVIAR y sin tocar inventario', async () => {
    const inv = await inventario(e.pool, 'ORG-A', 'KIT-AGUA');
    const r = await e.post(sol, '/requests/A-003/submit');
    expect(r.status).toBe(200);
    expect(await estadoDe(e.pool, 'A-003')).toBe('ENVIADA');
    const ev = await e.pool.query<{ from_status: string; to_status: string }>(
      "SELECT from_status, to_status FROM audit_events WHERE action = 'ENVIAR'",
    );
    expect(ev.rows).toEqual([{ from_status: 'BORRADOR', to_status: 'ENVIADA' }]);
    expect(await inventario(e.pool, 'ORG-A', 'KIT-AGUA')).toEqual(inv);
  });

  it('AC-RF04-04: otro solicitante recibe 404 y el coordinador 403 al enviar A-003', async () => {
    const otro = await e.login(CUENTAS.sol2A);
    const c = await e.login(CUENTAS.coordA);
    expect((await e.post(otro, '/requests/A-003/submit')).status).toBe(404);
    expect((await e.post(c, '/requests/A-003/submit')).status).toBe(403);
    expect(await estadoDe(e.pool, 'A-003')).toBe('BORRADOR');
    expect(await eventos(e.pool)).toBe(0);
  });

  it('AC-RF04-05: el dueno cancela A-002 ENVIADA con un evento CANCELAR', async () => {
    const r = await e.post(sol, '/requests/A-002/cancel');
    expect(r.status).toBe(200);
    expect(await estadoDe(e.pool, 'A-002')).toBe('CANCELADA');
    expect(await eventos(e.pool, 'CANCELAR')).toBe(1);
  });

  it('AC-RF04-06: cancelar un BORRADOR responde 409', async () => {
    const r = await e.post(sol, '/requests/A-003/cancel');
    expect(r.status).toBe(409);
    expect(await estadoDe(e.pool, 'A-003')).toBe('BORRADOR');
  });

  it('AC-RF04-07: coordinador (403) y otro solicitante (404) no pueden cancelar A-002', async () => {
    const otro = await e.login(CUENTAS.sol2A);
    const c = await e.login(CUENTAS.coordA);
    expect((await e.post(c, '/requests/A-002/cancel')).status).toBe(403);
    expect((await e.post(otro, '/requests/A-002/cancel')).status).toBe(404);
    expect(await estadoDe(e.pool, 'A-002')).toBe('ENVIADA');
  });

  it('AC-RF04-08: enviar otra vez una ENVIADA responde 409 y no duplica el evento', async () => {
    const r = await e.post(sol, '/requests/A-001/submit');
    expect(r.status).toBe(409);
    expect(await eventos(e.pool, 'ENVIAR')).toBe(0);
  });
});
