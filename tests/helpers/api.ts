// Ayudas para pruebas de la API con base real: app, reloj controlado, sesion y consultas a la base.
import type { Express } from 'express';
import type pg from 'pg';
import pino from 'pino';
import request from 'supertest';
import { createApp, type DependenciasApp } from '../../apps/api/src/app';
import { crearPoolDePruebas, migrar, resetDb } from './db';

export const CLAVE = process.env.DEMO_PASSWORD?.trim() || 'Demo-Nexo-2030';
export const RELOJ_INICIAL = '2030-01-10T14:00:00Z';

export const CUENTAS = {
  solA: 'org-a-solicitante@example.test',
  sol2A: 'org-a-solicitante2@example.test',
  coordA: 'org-a-coordinador@example.test',
  bodegaA: 'org-a-bodega@example.test',
  audA: 'org-a-auditor@example.test',
  solB: 'org-b-solicitante@example.test',
  coordB: 'org-b-coordinador@example.test',
  bodegaB: 'org-b-bodega@example.test',
  audB: 'org-b-auditor@example.test',
} as const;

export interface Entorno {
  pool: pg.Pool;
  app: Express;
  reloj: { ahora: Date };
  ganchos: NonNullable<DependenciasApp['ganchosDePrueba']>;
  login(email: string): Promise<string>;
  get(token: string | null, ruta: string, q?: Record<string, unknown>): request.Test;
  post(token: string | null, ruta: string, cuerpo?: object): request.Test;
  patch(token: string | null, ruta: string, cuerpo?: object): request.Test;
  cerrar(): Promise<void>;
}

export interface OpcionesEntorno {
  aiProvider?: DependenciasApp['aiProvider'];
  aiTimeoutMs?: number;
  logger?: DependenciasApp['logger'];
}

export async function crearEntorno(opciones: OpcionesEntorno = {}): Promise<Entorno> {
  const pool = crearPoolDePruebas();
  await migrar(pool);
  const reloj = { ahora: new Date(RELOJ_INICIAL) };
  const ganchos: Entorno['ganchos'] = {};
  const app = createApp({
    pool,
    clock: () => reloj.ahora,
    ganchosDePrueba: {
      despuesDeLineaReservada: (i) => ganchos.despuesDeLineaReservada?.(i),
    },
    sessionHours: 8,
    logger: opciones.logger ?? pino({ level: 'silent' }),
    aiProvider: opciones.aiProvider,
    aiTimeoutMs: opciones.aiTimeoutMs,
  });
  const con = (t: request.Test, token: string | null) =>
    token ? t.set('Authorization', `Bearer ${token}`) : t;
  return {
    pool,
    app,
    reloj,
    ganchos,
    async login(email) {
      const r = await request(app).post('/auth/login').send({ email, password: CLAVE });
      if (r.status !== 200) throw new Error(`login fallo para ${email}: ${r.status}`);
      return r.body.token as string;
    },
    get: (token, ruta, q) =>
      con(
        request(app)
          .get(ruta)
          .query(q ?? {}),
        token,
      ),
    post: (token, ruta, cuerpo) =>
      con(
        request(app)
          .post(ruta)
          .send(cuerpo ?? {}),
        token,
      ),
    patch: (token, ruta, cuerpo) =>
      con(
        request(app)
          .patch(ruta)
          .send(cuerpo ?? {}),
        token,
      ),
    async cerrar() {
      await pool.end();
    },
  };
}

export async function reiniciar(e: Entorno): Promise<void> {
  e.reloj.ahora = new Date(RELOJ_INICIAL);
  Object.keys(e.ganchos).forEach((k) => delete (e.ganchos as Record<string, unknown>)[k]);
  await resetDb(e.pool);
}

// ---- consultas a la base (oraculos independientes del codigo HTTP) --------------------------------

export async function inventario(pool: pg.Pool, org: string, sku: string) {
  const r = await pool.query<{ on_hand: number; reserved: number }>(
    `SELECT on_hand, reserved FROM inventory i JOIN skus s ON s.id = i.sku_id
      WHERE i.org_id = $1 AND s.code = $2`,
    [org, sku],
  );
  const f = r.rows[0];
  if (!f) throw new Error(`sin inventario ${org} ${sku}`);
  return { fisico: f.on_hand, reservado: f.reserved, disponible: f.on_hand - f.reserved };
}

export async function estadoDe(pool: pg.Pool, code: string): Promise<string> {
  const r = await pool.query<{ status: string }>('SELECT status FROM requests WHERE code = $1', [
    code,
  ]);
  return r.rows[0]!.status;
}

export async function eventos(pool: pg.Pool, accion?: string): Promise<number> {
  const r = await pool.query<{ n: number }>(
    accion
      ? 'SELECT count(*)::int AS n FROM audit_events WHERE action = $1'
      : 'SELECT count(*)::int AS n FROM audit_events',
    accion ? [accion] : [],
  );
  return r.rows[0]!.n;
}

export async function llaves(pool: pg.Pool): Promise<number> {
  return (await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM idempotency_keys'))
    .rows[0]!.n;
}

export async function fotoInventario(pool: pg.Pool): Promise<string> {
  const r = await pool.query(
    'SELECT org_id, sku_id, on_hand, reserved FROM inventory ORDER BY org_id, sku_id',
  );
  return JSON.stringify(r.rows);
}

/** Inserta una solicitud directamente en la base (rapido; para preparar escenarios). */
export async function sembrarSolicitud(
  pool: pg.Pool,
  o: {
    code: string;
    org?: string;
    dueno?: string;
    estado?: string;
    lines: { sku: string; q: number }[];
    zona?: string;
    prioridad?: string;
    fecha?: string;
    notas?: string | null;
  },
): Promise<void> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, notes, status)
     VALUES ($1, $2, (SELECT id FROM users WHERE email = $3), $4, $5, $6, $7, $8) RETURNING id`,
    [
      o.code,
      o.org ?? 'ORG-A',
      o.dueno ?? CUENTAS.solA,
      o.zona ?? 'NORTE',
      o.prioridad ?? 'NORMAL',
      o.fecha ?? '2030-01-20T14:00:00Z',
      o.notas ?? null,
      o.estado ?? 'ENVIADA',
    ],
  );
  for (const l of o.lines) {
    await pool.query(
      `INSERT INTO request_lines (request_id, sku_id, quantity)
       VALUES ($1, (SELECT id FROM skus WHERE code = $2), $3)`,
      [r.rows[0]!.id, l.sku, l.q],
    );
  }
}

export const cuerpoValido = (extra: Record<string, unknown> = {}) => ({
  zone: 'NORTE',
  priority: 'NORMAL',
  requiredDate: '2030-01-20T14:00:00Z',
  lines: [{ sku: 'KIT-AGUA', quantity: 2 }],
  ...extra,
});
