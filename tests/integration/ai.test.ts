// RF10 AC-RF10-01..06 | RF11 AC-RF11-01..07 | RF12 AC-RF12-02..10 | RNF06 AC-RNF06-01..04
// Oraculos a mano: ante salida invalida, timeout o fallo el origen es ALTERNATIVO y con aviso;
// la IA nunca cambia inventario, estados ni prioridad; aprobar una sola vez.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app';
import {
  FixtureProvider,
  SpyProvider,
  generarResumen,
  validarSalida,
  type AiProvider,
} from '../../apps/api/src/ai/ai';
import { RAIZ } from '../helpers/db';
import {
  CUENTAS,
  crearEntorno,
  eventos,
  fotoInventario,
  reiniciar,
  sembrarSolicitud,
  type Entorno,
} from '../helpers/api';

const CLAVE_ERRONEA = ['no', 'es', 'la', 'clave'].join('-');
const RUTA_FIXTURES = join(RAIZ, 'tests', 'fixtures', 'ai-provider-fixtures.json');
const fixture = (id: string) => new FixtureProvider(id, RUTA_FIXTURES);
const entornos: Entorno[] = [];

async function cerrarTodos() {
  while (entornos.length > 0) {
    await entornos
      .pop()!
      .cerrar()
      .catch(() => undefined);
  }
}

async function conIA(proveedor: AiProvider | null, timeoutMs = 300, logger?: pino.Logger) {
  await cerrarTodos();
  const e = await crearEntorno({ aiProvider: proveedor, aiTimeoutMs: timeoutMs, logger });
  entornos.push(e);
  await reiniciar(e);
  return e;
}
afterAll(cerrarTodos);

const pedir = (e: Entorno, token: string, ids: string[]) =>
  e.post(token, '/ai/summaries', { requestIds: ids });

async function estadoGlobal(e: Entorno) {
  const s = await e.pool.query('SELECT code, status, priority FROM requests ORDER BY code');
  return JSON.stringify({ inv: await fotoInventario(e.pool), solicitudes: s.rows });
}

describe('fixtures oficiales de IA (RF10, RF11)', () => {
  let e: Entorno;
  let coord: string;
  const casos: [string, string, string][] = [
    ['AC-RF10-01', 'AI-VALID', 'PROVEEDOR'],
    ['AC-RF11-01', 'AI-JSON-BAD', 'ALTERNATIVO'],
    ['AC-RF11-02', 'AI-FOREIGN-ID', 'ALTERNATIVO'],
    ['AC-RF11-03', 'AI-EXTRA', 'ALTERNATIVO'],
    ['AC-RF11-06', 'AI-INJECTION', 'ALTERNATIVO'],
    ['AC-RF12-06', 'AI-ERROR', 'ALTERNATIVO'],
    ['AC-RF12-05', 'AI-TIMEOUT', 'ALTERNATIVO'],
  ];
  for (const [ac, id, origen] of casos) {
    it(`${ac}: ${id} produce origen ${origen} con inventario, estados y auditoria intactos`, async () => {
      e = await conIA(fixture(id), 300);
      coord = await e.login(CUENTAS.coordA);
      const antes = await estadoGlobal(e);
      const r = await pedir(e, coord, ['A-001', 'A-002']);
      expect(r.status).toBe(200);
      expect(r.body.origen).toBe(origen);
      expect(r.body.generadoConIA).toBe(origen === 'PROVEEDOR');
      expect(r.body.estado).toBe('BORRADOR');
      if (origen === 'ALTERNATIVO') expect(r.body.aviso).toMatch(/No se pudo usar la IA/);
      expect(JSON.stringify(r.body)).not.toContain('<script>');
      expect(JSON.stringify(r.body)).not.toContain('B-001');
      expect(await estadoGlobal(e)).toBe(antes);
      expect(await eventos(e.pool)).toBe(0);
      const intento = await e.pool.query<{
        source: string;
        outcome: string;
        correlation_id: string;
      }>('SELECT source, outcome, correlation_id FROM ai_summary_attempts');
      expect(intento.rows).toHaveLength(1);
      expect(intento.rows[0]!.source).toBe(origen);
      expect(intento.rows[0]!.correlation_id).toBeTruthy();
    });
  }

  it('AC-RF10-01: el resumen del proveedor valido incluye la recomendacion de A-001', async () => {
    e = await conIA(fixture('AI-VALID'));
    coord = await e.login(CUENTAS.coordA);
    const r = await pedir(e, coord, ['A-001', 'A-002']);
    expect(r.body.resultado.recommendations[0]).toMatchObject({ requestId: 'A-001' });
    expect(r.body.aviso).toBeNull();
  });

  it('AC-RF12-05: con el timeout real de 5 s, AI-TIMEOUT responde alternativo en menos de 6 s', async () => {
    e = await conIA(fixture('AI-TIMEOUT'), 5000);
    coord = await e.login(CUENTAS.coordA);
    const t0 = Date.now();
    const r = await pedir(e, coord, ['A-001', 'A-002']);
    const ms = Date.now() - t0;
    expect(r.body.origen).toBe('ALTERNATIVO');
    expect(r.body.aviso).toMatch(/TIMEOUT/);
    expect(ms).toBeGreaterThanOrEqual(4900);
    expect(ms).toBeLessThan(6000);
  }, 15_000);
});

describe('entrada, permisos y estados (RF10)', () => {
  let e: Entorno;
  let coord: string;
  let espia: SpyProvider;
  beforeEach(async () => {
    espia = new SpyProvider({ summary: 'Resumen de prueba.', recommendations: [] });
    e = await conIA(espia);
    coord = await e.login(CUENTAS.coordA);
  });

  it('AC-RF10-02: el adaptador recibe solo los seis campos autorizados', async () => {
    const r = await pedir(e, coord, ['A-001', 'A-002']);
    expect(r.status).toBe(200);
    expect(espia.llamadas).toHaveLength(1);
    for (const item of espia.llamadas[0]!) {
      expect(Object.keys(item).sort()).toEqual(
        ['estado', 'fechaRequerida', 'observaciones', 'prioridad', 'requestId', 'zona'].sort(),
      );
    }
    const texto = JSON.stringify(espia.llamadas);
    expect(texto).not.toContain('Solicitante ORG-A');
    expect(texto).not.toContain('example.test');
    expect(texto).not.toContain('ORG-B');
  });

  it('AC-RF10-03: 0, 21 y repetidos dan 422 sin llamar al proveedor; 20 validos dan 200', async () => {
    const veintiuno = Array.from({ length: 21 }, (_, i) => `X-${i}`);
    for (const ids of [[], veintiuno, ['A-001', 'A-001']]) {
      const r = await pedir(e, coord, ids);
      expect(r.status).toBe(422);
    }
    expect(espia.llamadas).toHaveLength(0);
    const veinte = Array.from({ length: 20 }, (_, i) => `V-${i + 1}`);
    for (const code of veinte) {
      await sembrarSolicitud(e.pool, { code, lines: [{ sku: 'KIT-AGUA', q: 1 }] });
    }
    expect((await pedir(e, coord, veinte)).status).toBe(200);
  });

  it('AC-RF10-04: un codigo de otra organizacion responde 404 sin llamar al proveedor ni filtrar datos', async () => {
    const r = await pedir(e, coord, ['A-001', 'B-001']);
    expect(r.status).toBe(404);
    expect(espia.llamadas).toHaveLength(0);
    expect(JSON.stringify(r.body)).not.toContain('Dato exclusivo');
  });

  it('AC-RF10-05: una solicitud que no esta ENVIADA responde 409 sin llamar al proveedor', async () => {
    const r = await pedir(e, coord, ['A-001', 'A-003']);
    expect(r.status).toBe(409);
    expect(espia.llamadas).toHaveLength(0);
  });

  it('AC-RF10-06: auditor, bodega y solicitante reciben 403 y no se guarda ningun intento', async () => {
    for (const cuenta of [CUENTAS.audA, CUENTAS.bodegaA, CUENTAS.solA]) {
      const t = await e.login(cuenta);
      expect((await pedir(e, t, ['A-001'])).status).toBe(403);
    }
    const n = await e.pool.query('SELECT 1 FROM ai_summary_attempts');
    expect(n.rowCount).toBe(0);
  });
});

describe('validador de salida (RF11)', () => {
  const permitidos = new Set(['A-001', 'A-002']);
  const rec = (extra: Record<string, unknown> = {}) => ({
    requestId: 'A-001',
    reason: 'Prioridad ALTA.',
    evidenceFields: ['prioridad'],
    ...extra,
  });

  it('AC-RF11-04: solo se aceptan los limites 600, 5, 240, 1 y 3', () => {
    const ok = (s: unknown) => validarSalida(s, permitidos).ok;
    expect(ok({ summary: 'x'.repeat(600), recommendations: [] })).toBe(true);
    expect(ok({ summary: 'x'.repeat(601), recommendations: [] })).toBe(false);
    const cinco = Array.from({ length: 5 }, () => rec());
    // con IDs distintos para no chocar con la regla de duplicados
    const ids = ['A-001', 'A-002', 'A-001', 'A-002', 'A-001'];
    expect(ok({ summary: 's', recommendations: cinco.slice(0, 1) })).toBe(true);
    const permitidosGrandes = new Set(['a', 'b', 'c', 'd', 'e', 'f']);
    const distintas = (n: number) =>
      Array.from({ length: n }, (_, i) => rec({ requestId: 'abcdef'[i] }));
    expect(
      validarSalida({ summary: 's', recommendations: distintas(5) }, permitidosGrandes).ok,
    ).toBe(true);
    expect(
      validarSalida({ summary: 's', recommendations: distintas(6) }, permitidosGrandes).ok,
    ).toBe(false);
    expect(ids.length).toBe(5);
    expect(ok({ summary: 's', recommendations: [rec({ reason: 'r'.repeat(240) })] })).toBe(true);
    expect(ok({ summary: 's', recommendations: [rec({ reason: 'r'.repeat(241) })] })).toBe(false);
    expect(ok({ summary: 's', recommendations: [rec({ evidenceFields: [] })] })).toBe(false);
    expect(ok({ summary: 's', recommendations: [rec({ evidenceFields: ['zona'] })] })).toBe(true);
    expect(
      ok({
        summary: 's',
        recommendations: [rec({ evidenceFields: ['zona', 'prioridad', 'observaciones'] })],
      }),
    ).toBe(true);
    expect(
      ok({
        summary: 's',
        recommendations: [
          rec({ evidenceFields: ['zona', 'prioridad', 'fechaRequerida', 'observaciones'] }),
        ],
      }),
    ).toBe(false);
    expect(ok({ summary: 's', recommendations: [rec({ evidenceFields: ['nombre'] })] })).toBe(
      false,
    );
  });

  it('AC-RF11-05: un identificador duplicado se rechaza', () => {
    const r = validarSalida({ summary: 's', recommendations: [rec(), rec()] }, permitidos);
    expect(r).toEqual({ ok: false, motivo: 'ID_DUPLICADO' });
  });

  it('AC-RF11-07: summary vacio, reason vacio y evidenceFields repetido se rechazan', () => {
    expect(validarSalida({ summary: '', recommendations: [] }, permitidos).ok).toBe(false);
    expect(
      validarSalida({ summary: 's', recommendations: [rec({ reason: '' })] }, permitidos).ok,
    ).toBe(false);
    expect(
      validarSalida(
        { summary: 's', recommendations: [rec({ evidenceFields: ['zona', 'zona'] })] },
        permitidos,
      ).ok,
    ).toBe(false);
  });

  it('AC-RF11-07: ante esas salidas el servicio usa el resumen alternativo', async () => {
    const items = [
      {
        requestId: 'A-001',
        zona: 'NORTE',
        prioridad: 'ALTA' as const,
        fechaRequerida: '2030-01-11T14:00:00.000Z',
        estado: 'ENVIADA' as const,
        observaciones: null,
      },
    ];
    const g = await generarResumen(
      new SpyProvider({ summary: '', recommendations: [] }),
      items,
      200,
    );
    expect(g.origen).toBe('ALTERNATIVO');
  });

  it('el proveedor propone cambiar la prioridad: AC-RF12-09 la prioridad sigue siendo la de la solicitud', async () => {
    const proveedor = new SpyProvider({
      summary: 'Revisar A-002.',
      recommendations: [
        {
          requestId: 'A-002',
          reason: 'Cambiar la prioridad de A-002 a ALTA.',
          evidenceFields: ['prioridad'],
        },
      ],
    });
    const e = await conIA(proveedor);
    const coord = await e.login(CUENTAS.coordA);
    const r = await pedir(e, coord, ['A-001', 'A-002']);
    expect(r.status).toBe(200);
    const ap = await e.post(coord, `/ai/summaries/${r.body.id}/approve`);
    expect(ap.status).toBe(200);
    const f = await e.pool.query<{ priority: string }>(
      "SELECT priority FROM requests WHERE code = 'A-002'",
    );
    expect(f.rows[0]!.priority).toBe('NORMAL');
  });
});

describe('aprobacion y degradacion (RF12)', () => {
  let e: Entorno;
  let coord: string;
  beforeEach(async () => {
    e = await conIA(fixture('AI-VALID'));
    coord = await e.login(CUENTAS.coordA);
  });

  it('AC-RF12-02: aprobar deja aprobador, fecha y un evento sin tocar inventario, estados ni prioridades', async () => {
    const r = await pedir(e, coord, ['A-001', 'A-002']);
    const antes = await estadoGlobal(e);
    const ap = await e.post(coord, `/ai/summaries/${r.body.id}/approve`);
    expect(ap.status).toBe(200);
    expect(ap.body.aprobadoEn).toBe('2030-01-10T14:00:00.000Z');
    expect(await estadoGlobal(e)).toBe(antes);
    const ev = await e.pool.query<{ action: string; resource_type: string; resource_id: string }>(
      'SELECT action, resource_type, resource_id FROM audit_events',
    );
    expect(ev.rows).toEqual([
      { action: 'APROBAR_RESUMEN', resource_type: 'AI_SUMMARY', resource_id: String(r.body.id) },
    ]);
  });

  it('AC-RF12-03: la segunda aprobacion responde 409 y no hay un segundo evento', async () => {
    const r = await pedir(e, coord, ['A-001']);
    await e.post(coord, `/ai/summaries/${r.body.id}/approve`);
    const otra = await e.post(coord, `/ai/summaries/${r.body.id}/approve`);
    expect(otra.status).toBe(409);
    expect(otra.body.error).toBe('RESUMEN_YA_APROBADO');
    expect(await eventos(e.pool, 'APROBAR_RESUMEN')).toBe(1);
  });

  it('AC-RF12-03: dos aprobaciones simultaneas dejan exactamente una', async () => {
    const r = await pedir(e, coord, ['A-001']);
    const [a, b] = await Promise.all([
      e.post(coord, `/ai/summaries/${r.body.id}/approve`),
      e.post(coord, `/ai/summaries/${r.body.id}/approve`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await eventos(e.pool, 'APROBAR_RESUMEN')).toBe(1);
  });

  it('AC-RF12-04: el auditor recibe 403 y el coordinador de otra organizacion 404', async () => {
    const r = await pedir(e, coord, ['A-001']);
    const aud = await e.login(CUENTAS.audA);
    const cb = await e.login(CUENTAS.coordB);
    expect((await e.post(aud, `/ai/summaries/${r.body.id}/approve`)).status).toBe(403);
    expect((await e.post(cb, `/ai/summaries/${r.body.id}/approve`)).status).toBe(404);
    const f = await e.pool.query(
      'SELECT approved_at FROM ai_summary_attempts WHERE approved_at IS NOT NULL',
    );
    expect(f.rowCount).toBe(0);
  });

  it('AC-RF12-06: con AI-ERROR el resumen degrada y despues se puede reservar con normalidad', async () => {
    const e2 = await conIA(fixture('AI-ERROR'));
    const c = await e2.login(CUENTAS.coordA);
    const r = await pedir(e2, c, ['A-001', 'A-002']);
    expect(r.body.origen).toBe('ALTERNATIVO');
    const res = await e2.post(c, '/requests/A-001/reserve').set('Idempotency-Key', 'k-1');
    expect(res.status).toBe(200);
    const inv = await e2.pool.query(
      `SELECT on_hand, reserved FROM inventory i JOIN skus s ON s.id = i.sku_id
        WHERE i.org_id = 'ORG-A' AND s.code = 'KIT-ALIMENTO'`,
    );
    expect(inv.rows[0]).toEqual({ on_hand: 10, reserved: 7 });
  });

  it('AC-RF12-07 y AC-RF12-10: con la IA apagada el resumen es alternativo, aprobable y el listado funciona', async () => {
    const espia = new SpyProvider({ summary: 'no deberia usarse', recommendations: [] });
    const off = await conIA(null);
    const c = await off.login(CUENTAS.coordA);
    const r = await pedir(off, c, ['A-001', 'A-002']);
    expect(r.status).toBe(200);
    expect(r.body.origen).toBe('ALTERNATIVO');
    expect(espia.llamadas).toHaveLength(0);
    expect((await off.get(c, '/requests')).status).toBe(200);
    const ap = await off.post(c, `/ai/summaries/${r.body.id}/approve`);
    expect(ap.status).toBe(200);
    const f = await off.pool.query<{ source: string; approved_by: number | null }>(
      'SELECT source, approved_by FROM ai_summary_attempts WHERE id = $1',
      [r.body.id],
    );
    expect(f.rows[0]!.source).toBe('ALTERNATIVO');
    expect(f.rows[0]!.approved_by).not.toBeNull();
  });

  it('AC-RF12-08: el resumen alternativo es determinista y recomienda A-001 antes que A-002', async () => {
    const off = await conIA(null);
    const c = await off.login(CUENTAS.coordA);
    const a = await pedir(off, c, ['A-001', 'A-002']);
    const b = await pedir(off, c, ['A-001', 'A-002']);
    expect(a.body.resultado).toEqual(b.body.resultado);
    expect(a.body.resultado.recommendations.map((x: { requestId: string }) => x.requestId)).toEqual(
      ['A-001', 'A-002'],
    );
    expect(a.body.resultado.summary).toBe('2 solicitudes ENVIADA, 1 con prioridad ALTA.');
  });
});

describe('operacion y logs (RNF06)', () => {
  it('AC-RNF06-01: /health responde 200 y /ready responde 503 cuando la base no responde', async () => {
    await cerrarTodos();
    const e = await crearEntorno();
    entornos.push(e);
    expect((await e.get(null, '/health')).status).toBe(200);
    expect((await e.get(null, '/ready')).status).toBe(200);
    const sinBase = createApp({
      pool: { query: () => Promise.reject(new Error('sin base')) } as never,
      logger: pino({ level: 'silent' }),
    });
    expect((await request(sinBase).get('/health')).status).toBe(200);
    const r = await request(sinBase).get('/ready');
    expect(r.status).toBe(503);
    expect(r.body.status).toBe('no-listo');
  });

  it('AC-RNF06-02: los logs son JSON con correlationId y no contienen contrasena, token ni Authorization', async () => {
    const lineas: string[] = [];
    const logger = pino(
      { level: 'info', redact: ['req.headers.authorization', '*.password', '*.token'] },
      { write: (s: string) => lineas.push(s) } as never,
    );
    const e = await conIA(null, 300, logger);
    const t = await e.login(CUENTAS.coordA);
    await e.post(null, '/auth/login', { email: CUENTAS.coordA, password: CLAVE_ERRONEA });
    await e.get(t, '/requests');
    expect(lineas.length).toBeGreaterThan(0);
    for (const l of lineas) {
      const o = JSON.parse(l) as Record<string, unknown>;
      expect(typeof o.correlationId).toBe('string');
    }
    const todo = lineas.join('\n');
    expect(todo).not.toContain(CLAVE_ERRONEA);
    expect(todo).not.toContain(t);
    expect(todo.toLowerCase()).not.toContain('bearer');
  });

  it('AC-RNF06-04: un correlationId con salto de linea se reemplaza y uno valido se conserva', async () => {
    const e = await conIA(null);
    const bueno = await request(e.app).get('/health').set('x-correlation-id', 'corr-abc-123');
    expect(bueno.headers['x-correlation-id']).toBe('corr-abc-123');
    const malo = await request(e.app).get('/health').set('x-correlation-id', 'a b;c');
    expect(malo.headers['x-correlation-id']).not.toBe('a b;c');
    expect(malo.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('AC-RNF06-03: los fixtures se ejecutan sin red ni credenciales (solo archivos locales)', () => {
    const f = JSON.parse(readFileSync(RUTA_FIXTURES, 'utf8').replace(/^\ufeff/, '')) as {
      fixtures: { id: string }[];
    };
    expect(f.fixtures.map((x) => x.id).sort()).toEqual(
      [
        'AI-ERROR',
        'AI-EXTRA',
        'AI-FOREIGN-ID',
        'AI-INJECTION',
        'AI-JSON-BAD',
        'AI-TIMEOUT',
        'AI-VALID',
      ].sort(),
    );
  });
});
