// RNF02 AC-RNF02-03 | RNF04 AC-RNF04-02 | RF03 AC-RF03-03 AC-RF03-04 AC-RF03-07 (restriccion de base)
// RF09 AC-RF09-03 (disparador, parte de base) | RF01 AC-RF01-07 (hash, parte de base)
// RF07 AC-RF07-04 (llave por usuario, parte de base) | RNF01 (RLS)
// Oraculos escritos a mano a partir del caso: KIT-ALIMENTO de ORG-A fisico 10 y reservado 0.
// Estas pruebas verifican la BASE (restricciones y datos), no la API (llega en R3).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  RAIZ,
  codigoDeError,
  crearPoolDePruebas,
  migrar,
  resetDb,
  sembrarBase,
} from '../helpers/db';

const TABLAS = [
  'organizations',
  'users',
  'sessions',
  'skus',
  'inventory',
  'requests',
  'request_lines',
  'audit_events',
  'idempotency_keys',
  'ai_summary_attempts',
  'schema_migrations',
];
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const RAISE_EXCEPTION = 'P0001';

const FILTRO_ALIMENTO_A = `org_id = 'ORG-A' AND sku_id = (SELECT id FROM skus WHERE code = 'KIT-ALIMENTO')`;

let pool: pg.Pool;

async function una<T extends object>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await pool.query<T>(sql, params);
  const fila = r.rows[0];
  if (!fila) throw new Error('La consulta no devolvio filas');
  return fila;
}

const inventarioAlimentoA = () =>
  una<{ on_hand: number; reserved: number }>(
    `SELECT on_hand, reserved FROM inventory WHERE ${FILTRO_ALIMENTO_A}`,
  );

beforeAll(async () => {
  pool = crearPoolDePruebas();
  await migrar(pool);
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await resetDb(pool);
});

describe('migraciones y seed (AC-RNF04-02)', () => {
  it('AC-RNF04-02: aplicar las migraciones otra vez no falla ni duplica registros', async () => {
    const antes = await una<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations');
    await migrar(pool);
    await migrar(pool);
    const despues = await una<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations');
    const nombres = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations WHERE name NOT LIKE 'seed_%' ORDER BY name",
    );
    expect(despues.n).toBe(antes.n);
    expect(nombres.rows.map((r) => r.name)).toEqual(['001_init.sql', '002_security.sql']);
  });

  it('AC-RNF04-02: sembrar otra vez no duplica datos y deja 2 organizaciones, 4 SKU y 9 cuentas', async () => {
    await sembrarBase(pool);
    await sembrarBase(pool);
    const c = await una<Record<string, number>>(`SELECT
      (SELECT count(*)::int FROM organizations) AS organizaciones,
      (SELECT count(*)::int FROM skus) AS skus,
      (SELECT count(*)::int FROM users) AS cuentas,
      (SELECT count(*)::int FROM inventory) AS inventario,
      (SELECT count(*)::int FROM requests) AS solicitudes,
      (SELECT count(*)::int FROM request_lines) AS lineas`);
    expect(c).toEqual({
      organizaciones: 2,
      skus: 4,
      cuentas: 9,
      inventario: 6,
      solicitudes: 5,
      lineas: 5,
    });
  });

  it('el inventario sembrado coincide con los hechos oficiales del caso (fixture-scenarios.json)', async () => {
    const hechos = JSON.parse(
      readFileSync(join(RAIZ, 'docs', 'anexos', 'fixture-scenarios.json'), 'utf8').replace(
        /^\ufeff/,
        '',
      ),
    ) as { stock: { organizationId: string; sku: string; onHand: number; reserved: number }[] };
    const r = await pool.query<{ org_id: string; code: string; on_hand: number; reserved: number }>(
      `SELECT i.org_id, s.code, i.on_hand, i.reserved FROM inventory i
         JOIN skus s ON s.id = i.sku_id ORDER BY i.org_id, s.code`,
    );
    const esperado = hechos.stock
      .map((s) => ({
        org_id: s.organizationId,
        code: s.sku,
        on_hand: s.onHand,
        reserved: s.reserved,
      }))
      .sort((a, b) => (a.org_id + a.code).localeCompare(b.org_id + b.code));
    expect(r.rows).toEqual(esperado);
    // Oraculo explicito del caso (escrito a mano): ORG-A / KIT-ALIMENTO fisico 10, reservado 0.
    expect(await inventarioAlimentoA()).toEqual({ on_hand: 10, reserved: 0 });
  });

  it('las solicitudes sembradas son las del caso y no tienen reservas ni eventos previos', async () => {
    const r = await pool.query<{ code: string; org_id: string; status: string; notes: string }>(
      'SELECT code, org_id, status, notes FROM requests ORDER BY code',
    );
    expect(r.rows).toEqual([
      {
        code: 'A-001',
        org_id: 'ORG-A',
        status: 'ENVIADA',
        notes: 'Entrega comunitaria programada.',
      },
      { code: 'A-002', org_id: 'ORG-A', status: 'ENVIADA', notes: 'Solicitud pendiente.' },
      { code: 'A-003', org_id: 'ORG-A', status: 'BORRADOR', notes: 'Borrador de ejemplo.' },
      {
        code: 'A-004',
        org_id: 'ORG-A',
        status: 'CANCELADA',
        notes: 'Solicitud cancelada de ejemplo.',
      },
      { code: 'B-001', org_id: 'ORG-B', status: 'ENVIADA', notes: 'Dato exclusivo de ORG-B.' },
    ]);
    const lineas = await pool.query<{ code: string; sku: string; quantity: number }>(
      `SELECT r.code, s.code AS sku, l.quantity FROM request_lines l
         JOIN requests r ON r.id = l.request_id JOIN skus s ON s.id = l.sku_id ORDER BY r.code`,
    );
    expect(lineas.rows).toEqual([
      { code: 'A-001', sku: 'KIT-ALIMENTO', quantity: 7 },
      { code: 'A-002', sku: 'KIT-ALIMENTO', quantity: 7 },
      { code: 'A-003', sku: 'KIT-AGUA', quantity: 2 },
      { code: 'A-004', sku: 'KIT-HIGIENE', quantity: 3 },
      { code: 'B-001', sku: 'KIT-HIGIENE', quantity: 2 },
    ]);
    const previos = await una<{ eventos: number; reservado: number; sesiones: number }>(
      `SELECT (SELECT count(*)::int FROM audit_events) AS eventos,
              (SELECT coalesce(sum(reserved), 0)::int FROM inventory) AS reservado,
              (SELECT count(*)::int FROM sessions) AS sesiones`,
    );
    expect(previos).toEqual({ eventos: 0, reservado: 0, sesiones: 0 });
  });

  it('la frase exclusiva de ORG-B solo existe en B-001 (ORG-B)', async () => {
    const r = await pool.query<{ code: string; org_id: string }>(
      "SELECT code, org_id FROM requests WHERE notes LIKE '%Dato exclusivo de ORG-B.%'",
    );
    expect(r.rows).toEqual([{ code: 'B-001', org_id: 'ORG-B' }]);
  });

  it('KIT-INACTIVO esta inactivo y no tiene inventario', async () => {
    const s = await una<{ active: boolean; con_inventario: number }>(
      `SELECT s.active, (SELECT count(*)::int FROM inventory i WHERE i.sku_id = s.id) AS con_inventario
         FROM skus s WHERE s.code = 'KIT-INACTIVO'`,
    );
    expect(s).toEqual({ active: false, con_inventario: 0 });
  });

  it('el codigo por defecto de una solicitud nueva sigue la secuencia SOL-000001', async () => {
    const r = await una<{ code: string }>(
      `INSERT INTO requests (org_id, requester_id, zone, priority, required_date, status)
       VALUES ('ORG-A', (SELECT id FROM users WHERE email = 'org-a-solicitante@example.test'),
               'NORTE', 'NORMAL', '2030-01-20T14:00:00Z', 'BORRADOR') RETURNING code`,
    );
    expect(r.code).toBe('SOL-000001');
  });
});

describe('restricciones de inventario (RF05, RNF02)', () => {
  it('AC-RNF02-03: un UPDATE que deja reservado mayor que el fisico falla por CHECK', async () => {
    await pool.query(`UPDATE inventory SET reserved = 7 WHERE ${FILTRO_ALIMENTO_A}`);
    const e = await codigoDeError(
      pool,
      `UPDATE inventory SET reserved = 11 WHERE ${FILTRO_ALIMENTO_A}`,
    );
    expect(e.code).toBe(CHECK_VIOLATION);
    expect(await inventarioAlimentoA()).toEqual({ on_hand: 10, reserved: 7 });
  });

  it('AC-RNF02-03: un UPDATE que deja el fisico negativo falla por CHECK y no cambia nada', async () => {
    const e = await codigoDeError(
      pool,
      `UPDATE inventory SET on_hand = -1 WHERE ${FILTRO_ALIMENTO_A}`,
    );
    expect(e.code).toBe(CHECK_VIOLATION);
    expect(await inventarioAlimentoA()).toEqual({ on_hand: 10, reserved: 0 });
  });

  it('AC-RNF02-03: bajar el fisico por debajo de lo reservado falla por CHECK', async () => {
    await pool.query(`UPDATE inventory SET reserved = 7 WHERE ${FILTRO_ALIMENTO_A}`);
    const e = await codigoDeError(
      pool,
      `UPDATE inventory SET on_hand = 6 WHERE ${FILTRO_ALIMENTO_A}`,
    );
    expect(e.code).toBe(CHECK_VIOLATION);
    expect(await inventarioAlimentoA()).toEqual({ on_hand: 10, reserved: 7 });
  });

  it('AC-RNF02-03: reservado negativo falla por CHECK', async () => {
    const e = await codigoDeError(
      pool,
      `UPDATE inventory SET reserved = -1 WHERE ${FILTRO_ALIMENTO_A}`,
    );
    expect(e.code).toBe(CHECK_VIOLATION);
  });

  it('el UPDATE condicional de la reserva no aplica si no hay disponible (0 filas)', async () => {
    // Es la sentencia que usara el servicio de reserva: solo aplica si disponible >= cantidad.
    const sin = await pool.query(
      `UPDATE inventory SET reserved = reserved + 11
        WHERE ${FILTRO_ALIMENTO_A} AND on_hand - reserved >= 11`,
    );
    expect(sin.rowCount).toBe(0);
    expect(await inventarioAlimentoA()).toEqual({ on_hand: 10, reserved: 0 });
    const ok = await pool.query(
      `UPDATE inventory SET reserved = reserved + 7
        WHERE ${FILTRO_ALIMENTO_A} AND on_hand - reserved >= 7`,
    );
    expect(ok.rowCount).toBe(1);
    expect(await inventarioAlimentoA()).toEqual({ on_hand: 10, reserved: 7 });
  });
});

describe('restricciones de solicitudes (RF03)', () => {
  const idSolicitud = async (codigo: string) =>
    (await una<{ id: number }>('SELECT id FROM requests WHERE code = $1', [codigo])).id;
  const lineaHigiene = `INSERT INTO request_lines (request_id, sku_id, quantity)
    VALUES ($1, (SELECT id FROM skus WHERE code = 'KIT-HIGIENE'), $2)`;

  it('AC-RF03-03 (base): cantidades 0, -3 y 501 fallan por CHECK; 1 y 500 se aceptan', async () => {
    const id = await idSolicitud('A-003');
    for (const q of [0, -3, 501]) {
      const e = await codigoDeError(pool, lineaHigiene, [id, q]);
      expect(e.code).toBe(CHECK_VIOLATION);
    }
    for (const q of [1, 500]) {
      await pool.query(
        `DELETE FROM request_lines WHERE request_id = $1
           AND sku_id = (SELECT id FROM skus WHERE code = 'KIT-HIGIENE')`,
        [id],
      );
      await pool.query(lineaHigiene, [id, q]);
    }
    const n = await una<{ n: number }>(
      'SELECT count(*)::int AS n FROM request_lines WHERE request_id = $1',
      [id],
    );
    expect(n.n).toBe(2);
  });

  it('AC-RF03-03 (base): una cantidad decimal no entra en una columna entera', async () => {
    const id = await idSolicitud('A-003');
    const e = await codigoDeError(pool, lineaHigiene, [id, '2.5']);
    expect(e.code).toBe('22P02');
  });

  it('AC-RF03-04 (base): el mismo SKU dos veces en una solicitud falla por UNIQUE', async () => {
    const id = await idSolicitud('A-003');
    const e = await codigoDeError(
      pool,
      `INSERT INTO request_lines (request_id, sku_id, quantity)
       VALUES ($1, (SELECT id FROM skus WHERE code = 'KIT-AGUA'), 1)`,
      [id],
    );
    expect(e.code).toBe(UNIQUE_VIOLATION);
  });

  it('AC-RF03-07 (base): observaciones de 501 caracteres fallan y de 500 se aceptan', async () => {
    const insertar = (notas: string) =>
      codigoDeError(
        pool,
        `INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, notes, status)
         VALUES ($1, 'ORG-A', (SELECT id FROM users WHERE email = 'org-a-solicitante@example.test'),
                 'NORTE', 'NORMAL', '2030-01-20T14:00:00Z', $2, 'BORRADOR')`,
        [`T-${notas.length}`, notas],
      );
    const e501 = await insertar('x'.repeat(501));
    expect(e501.code).toBe(CHECK_VIOLATION);
    await pool.query(
      `INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, notes, status)
       VALUES ('T-500', 'ORG-A', (SELECT id FROM users WHERE email = 'org-a-solicitante@example.test'),
               'NORTE', 'NORMAL', '2030-01-20T14:00:00Z', $1, 'BORRADOR')`,
      ['x'.repeat(500)],
    );
    const n = await una<{ n: number }>(
      "SELECT count(*)::int AS n FROM requests WHERE code = 'T-500'",
    );
    expect(n.n).toBe(1);
  });

  it('la zona, la prioridad y el estado solo admiten los valores del caso', async () => {
    const base = (zona: string, prioridad: string, estado: string, codigo: string) =>
      codigoDeError(
        pool,
        `INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, status)
         VALUES ($4, 'ORG-A', (SELECT id FROM users WHERE email = 'org-a-solicitante@example.test'),
                 $1, $2, '2030-01-20T14:00:00Z', $3)`,
        [zona, prioridad, estado, codigo],
      );
    expect((await base('ESTE', 'NORMAL', 'BORRADOR', 'Z-1')).code).toBe(CHECK_VIOLATION);
    expect((await base('NORTE', 'URGENTE', 'BORRADOR', 'Z-2')).code).toBe(CHECK_VIOLATION);
    expect((await base('NORTE', 'NORMAL', 'ABIERTA', 'Z-3')).code).toBe(CHECK_VIOLATION);
  });

  it('el codigo de solicitud es unico', async () => {
    const e = await codigoDeError(
      pool,
      `INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, status)
       VALUES ('A-001', 'ORG-A', (SELECT id FROM users WHERE email = 'org-a-solicitante@example.test'),
               'NORTE', 'NORMAL', '2030-01-20T14:00:00Z', 'BORRADOR')`,
    );
    expect(e.code).toBe(UNIQUE_VIOLATION);
  });
});

describe('auditoria de solo escritura (RF09)', () => {
  async function insertarEvento(): Promise<number> {
    const r = await una<{ id: string }>(
      `INSERT INTO audit_events (user_id, org_id, resource_type, resource_id, action,
                                 from_status, to_status, correlation_id)
       VALUES ((SELECT id FROM users WHERE email = 'org-a-coordinador@example.test'), 'ORG-A',
               'REQUEST', 'A-001', 'RESERVAR', 'ENVIADA', 'RESERVADA', 'corr-0001')
       RETURNING id`,
    );
    return Number(r.id);
  }

  it('AC-RF09-03 (base): UPDATE sobre un evento falla por el disparador y no cambia nada', async () => {
    const id = await insertarEvento();
    const e = await codigoDeError(
      pool,
      "UPDATE audit_events SET action = 'ENTREGAR' WHERE id = $1",
      [id],
    );
    expect(e.code).toBe(RAISE_EXCEPTION);
    expect(e.message).toContain('solo escritura');
    const f = await una<{ action: string }>('SELECT action FROM audit_events WHERE id = $1', [id]);
    expect(f.action).toBe('RESERVAR');
  });

  it('AC-RF09-03 (base): DELETE sobre un evento falla y el evento sigue existiendo', async () => {
    const id = await insertarEvento();
    const e = await codigoDeError(pool, 'DELETE FROM audit_events WHERE id = $1', [id]);
    expect(e.code).toBe(RAISE_EXCEPTION);
    const n = await una<{ n: number }>('SELECT count(*)::int AS n FROM audit_events');
    expect(n.n).toBe(1);
  });

  it('el evento guarda identidad, organizacion, recurso, accion, estados y correlationId', async () => {
    const id = await insertarEvento();
    const f = await una<Record<string, unknown>>(
      `SELECT e.org_id, e.resource_type, e.resource_id, e.action, e.from_status, e.to_status,
              e.correlation_id, u.email, e.occurred_at IS NOT NULL AS con_fecha
         FROM audit_events e JOIN users u ON u.id = e.user_id WHERE e.id = $1`,
      [id],
    );
    expect(f).toEqual({
      org_id: 'ORG-A',
      resource_type: 'REQUEST',
      resource_id: 'A-001',
      action: 'RESERVAR',
      from_status: 'ENVIADA',
      to_status: 'RESERVADA',
      correlation_id: 'corr-0001',
      email: 'org-a-coordinador@example.test',
      con_fecha: true,
    });
  });

  it('una accion fuera de la lista o una aprobacion sobre una solicitud fallan por CHECK', async () => {
    const accionInvalida = await codigoDeError(
      pool,
      `INSERT INTO audit_events (user_id, org_id, resource_type, resource_id, action, correlation_id)
       VALUES ((SELECT id FROM users LIMIT 1), 'ORG-A', 'REQUEST', 'A-001', 'BORRAR', 'c')`,
    );
    expect(accionInvalida.code).toBe(CHECK_VIOLATION);
    const cruzada = await codigoDeError(
      pool,
      `INSERT INTO audit_events (user_id, org_id, resource_type, resource_id, action, correlation_id)
       VALUES ((SELECT id FROM users LIMIT 1), 'ORG-A', 'REQUEST', 'A-001', 'APROBAR_RESUMEN', 'c')`,
    );
    expect(cruzada.code).toBe(CHECK_VIOLATION);
  });
});

describe('cuentas, sesiones, llaves e intentos de IA', () => {
  it('AC-RF01-07 (base): las 9 contrasenas estan guardadas como hash bcrypt', async () => {
    const r = await una<{ total: number; con_hash: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE password_hash ~ '^\\$2[aby]\\$10\\$[./A-Za-z0-9]{53}$')::int AS con_hash
         FROM users`,
    );
    expect(r).toEqual({ total: 9, con_hash: 9 });
    const clave = process.env.DEMO_PASSWORD;
    if (clave) {
      const igual = await una<{ n: number }>(
        'SELECT count(*)::int AS n FROM users WHERE password_hash = $1',
        [clave],
      );
      expect(igual.n).toBe(0);
    }
  });

  it('el correo se guarda en minusculas y el rol solo admite los 4 del caso', async () => {
    const mayus = await codigoDeError(
      pool,
      `INSERT INTO users (org_id, email, display_name, password_hash, role)
       VALUES ('ORG-A', 'Nuevo@Example.test', 'X', 'h', 'AUDITOR')`,
    );
    expect(mayus.code).toBe(CHECK_VIOLATION);
    const rol = await codigoDeError(
      pool,
      `INSERT INTO users (org_id, email, display_name, password_hash, role)
       VALUES ('ORG-A', 'nuevo@example.test', 'X', 'h', 'ADMIN')`,
    );
    expect(rol.code).toBe(CHECK_VIOLATION);
  });

  it('una sesion que vence antes de crearse falla por CHECK', async () => {
    const e = await codigoDeError(
      pool,
      `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
       VALUES ('h1', (SELECT id FROM users LIMIT 1), '2030-01-10T14:00:00Z', '2030-01-10T13:00:00Z')`,
    );
    expect(e.code).toBe(CHECK_VIOLATION);
  });

  it('AC-RF07-04 (base): la misma llave la usan usuarios distintos, pero no se repite por usuario', async () => {
    const insertar = (org: string, email: string) =>
      pool.query(
        `INSERT INTO idempotency_keys (org_id, user_id, operation, key, request_hash, status_code, response_body)
         VALUES ($1, (SELECT id FROM users WHERE email = $2), 'RESERVE', 'K-1', 'hash', 200, '{}'::jsonb)`,
        [org, email],
      );
    await insertar('ORG-A', 'org-a-coordinador@example.test');
    await insertar('ORG-B', 'org-b-coordinador@example.test');
    await expect(insertar('ORG-A', 'org-a-coordinador@example.test')).rejects.toMatchObject({
      code: UNIQUE_VIOLATION,
    });
    const n = await una<{ n: number }>('SELECT count(*)::int AS n FROM idempotency_keys');
    expect(n.n).toBe(2);
  });

  it('una llave vacia o de mas de 128 caracteres falla por CHECK y de 128 se acepta', async () => {
    const insertar = (llave: string) =>
      codigoDeError(
        pool,
        `INSERT INTO idempotency_keys (org_id, user_id, operation, key, request_hash, status_code, response_body)
         VALUES ('ORG-A', (SELECT id FROM users WHERE email = 'org-a-coordinador@example.test'),
                 'RESERVE', $1, 'h', 200, '{}'::jsonb)`,
        [llave],
      );
    expect((await insertar('')).code).toBe(CHECK_VIOLATION);
    expect((await insertar('k'.repeat(129))).code).toBe(CHECK_VIOLATION);
    await pool.query(
      `INSERT INTO idempotency_keys (org_id, user_id, operation, key, request_hash, status_code, response_body)
       VALUES ('ORG-A', (SELECT id FROM users WHERE email = 'org-a-coordinador@example.test'),
               'RESERVE', $1, 'h', 200, '{}'::jsonb)`,
      ['k'.repeat(128)],
    );
  });

  it('ai_summary_attempts: de 1 a 20 identificadores y aprobador y fecha van juntos', async () => {
    const insertar = (ids: string[], aprobador: boolean) =>
      codigoDeError(
        pool,
        `INSERT INTO ai_summary_attempts (org_id, user_id, request_ids, source, outcome, correlation_id,
                                         approved_by)
         VALUES ('ORG-A', (SELECT id FROM users WHERE email = 'org-a-coordinador@example.test'),
                 $1, 'ALTERNATIVO', 'OK', 'c',
                 ${aprobador ? "(SELECT id FROM users WHERE email = 'org-a-coordinador@example.test')" : 'NULL'})`,
        [ids],
      );
    expect((await insertar([], false)).code).toBe(CHECK_VIOLATION);
    const veintiuno = Array.from({ length: 21 }, (_, i) => `A-${i}`);
    expect((await insertar(veintiuno, false)).code).toBe(CHECK_VIOLATION);
    // approved_by sin approved_at rompe la regla de pareja
    expect((await insertar(['A-001'], true)).code).toBe(CHECK_VIOLATION);
  });
});

describe('seguridad por filas (RNF01)', () => {
  it('las 11 tablas de la aplicacion tienen RLS activo', async () => {
    const r = await pool.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1) ORDER BY c.relname`,
      [TABLAS],
    );
    expect(r.rows.map((x) => x.relname)).toEqual([...TABLAS].sort());
    expect(r.rows.filter((x) => !x.relrowsecurity)).toEqual([]);
  });
});
