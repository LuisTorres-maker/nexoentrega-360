// Solicitudes: borradores, detalle y listados. Toda busqueda filtra por organizacion de la sesion
// y, para SOLICITANTE, por dueno (404 si no es suyo: Q6).
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { ESTADOS, PRIORIDADES, ZONAS, type Estado } from '../domain/enums';
import {
  primerErrorDe,
  skuRepetido,
  solicitudSchema,
  type SolicitudInput,
} from '../domain/request-schema';
import { AppError, noEncontrada, validacion } from '../http/errors';
import type { UsuarioSesion } from '../http/types';

export interface DetalleSolicitud {
  code: string;
  zone: string;
  priority: string;
  requiredDate: string;
  notes: string | null;
  status: Estado;
  requesterName: string;
  lines: { sku: string; quantity: number }[];
  createdAt: string;
  updatedAt: string;
}

export type Conexion = Pool | PoolClient;

export function validarCuerpo(cuerpo: unknown): SolicitudInput {
  const r = solicitudSchema.safeParse(cuerpo);
  if (!r.success) {
    const e = primerErrorDe(r.error);
    throw validacion(e.campo, e.mensaje);
  }
  const repetido = skuRepetido(r.data.lines);
  if (repetido) throw validacion('lines', `El SKU ${repetido} esta repetido en la solicitud.`);
  return r.data;
}

/** Cada SKU debe existir y estar activo (Q8: 422). Devuelve codigo -> id. */
export async function resolverSkus(
  c: Conexion,
  lines: { sku: string }[],
): Promise<Map<string, number>> {
  const codigos = lines.map((l) => l.sku);
  const { rows } = await c.query<{ id: number; code: string; active: boolean }>(
    'SELECT id, code, active FROM skus WHERE code = ANY($1)',
    [codigos],
  );
  const porCodigo = new Map(rows.map((r) => [r.code, r]));
  const ids = new Map<string, number>();
  lines.forEach((l, i) => {
    const s = porCodigo.get(l.sku);
    if (!s) throw validacion(`lines.${i}.sku`, `El SKU ${l.sku} no existe.`);
    if (!s.active) throw validacion(`lines.${i}.sku`, `El SKU ${l.sku} esta inactivo.`);
    ids.set(l.sku, s.id);
  });
  return ids;
}

/** Fila de solicitud de MI organizacion (y mia si soy SOLICITANTE). null si no existe. */
export async function buscarSolicitud(
  c: Conexion,
  user: UsuarioSesion,
  code: string,
  opciones: { bloquear?: boolean; soloDueno?: boolean } = {},
): Promise<{ id: number; status: Estado; code: string } | null> {
  const params: unknown[] = [code, user.orgId];
  let donde = 'code = $1 AND org_id = $2';
  if (user.role === 'SOLICITANTE' || opciones.soloDueno) {
    params.push(user.id);
    donde += ` AND requester_id = $${params.length}`;
  }
  const { rows } = await c.query<{ id: number; status: Estado; code: string }>(
    `SELECT id, status, code FROM requests WHERE ${donde}${opciones.bloquear ? ' FOR UPDATE' : ''}`,
    params,
  );
  return rows[0] ?? null;
}

export async function detalleDe(c: Conexion, id: number): Promise<DetalleSolicitud> {
  const r = await c.query<{
    code: string;
    zone: string;
    priority: string;
    required_date: Date;
    notes: string | null;
    status: Estado;
    display_name: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT r.code, r.zone, r.priority, r.required_date, r.notes, r.status, u.display_name,
            r.created_at, r.updated_at
       FROM requests r JOIN users u ON u.id = r.requester_id WHERE r.id = $1`,
    [id],
  );
  const f = r.rows[0];
  if (!f) throw noEncontrada();
  const l = await c.query<{ sku: string; quantity: number }>(
    `SELECT s.code AS sku, l.quantity FROM request_lines l JOIN skus s ON s.id = l.sku_id
      WHERE l.request_id = $1 ORDER BY l.id`,
    [id],
  );
  return {
    code: f.code,
    zone: f.zone,
    priority: f.priority,
    requiredDate: f.required_date.toISOString(),
    notes: f.notes,
    status: f.status,
    requesterName: f.display_name,
    lines: l.rows,
    createdAt: f.created_at.toISOString(),
    updatedAt: f.updated_at.toISOString(),
  };
}

export async function detallePorCodigo(
  pool: Pool,
  user: UsuarioSesion,
  code: string,
): Promise<DetalleSolicitud> {
  const s = await buscarSolicitud(pool, user, code);
  if (!s) throw noEncontrada();
  return detalleDe(pool, s.id);
}

async function enTransaccion<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

async function escribirLineas(
  c: PoolClient,
  requestId: number,
  entrada: SolicitudInput,
  ids: Map<string, number>,
): Promise<void> {
  for (const l of entrada.lines) {
    await c.query('INSERT INTO request_lines (request_id, sku_id, quantity) VALUES ($1, $2, $3)', [
      requestId,
      ids.get(l.sku),
      l.quantity,
    ]);
  }
}

export async function crearBorrador(
  pool: Pool,
  ahora: Date,
  user: UsuarioSesion,
  cuerpo: unknown,
): Promise<DetalleSolicitud> {
  const entrada = validarCuerpo(cuerpo);
  return enTransaccion(pool, async (c) => {
    const ids = await resolverSkus(c, entrada.lines);
    const r = await c.query<{ id: number }>(
      `INSERT INTO requests (org_id, requester_id, zone, priority, required_date, notes, status,
                             created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'BORRADOR', $7, $7) RETURNING id`,
      [
        user.orgId,
        user.id,
        entrada.zone,
        entrada.priority,
        entrada.requiredDate,
        entrada.notes ?? null,
        ahora,
      ],
    );
    const id = r.rows[0]!.id;
    await escribirLineas(c, id, entrada, ids);
    return detalleDe(c, id);
  });
}

export async function editarBorrador(
  pool: Pool,
  ahora: Date,
  user: UsuarioSesion,
  code: string,
  cuerpo: unknown,
): Promise<DetalleSolicitud> {
  const existe = await buscarSolicitud(pool, user, code);
  if (!existe) throw noEncontrada();
  const entrada = validarCuerpo(cuerpo);
  return enTransaccion(pool, async (c) => {
    const s = await buscarSolicitud(c, user, code, { bloquear: true });
    if (!s) throw noEncontrada();
    if (s.status !== 'BORRADOR') {
      throw new AppError('ESTADO_INVALIDO', 'Solo se puede editar una solicitud en BORRADOR.');
    }
    const ids = await resolverSkus(c, entrada.lines);
    await c.query(
      `UPDATE requests SET zone = $1, priority = $2, required_date = $3, notes = $4, updated_at = $5
        WHERE id = $6`,
      [entrada.zone, entrada.priority, entrada.requiredDate, entrada.notes ?? null, ahora, s.id],
    );
    await c.query('DELETE FROM request_lines WHERE request_id = $1', [s.id]);
    await escribirLineas(c, s.id, entrada, ids);
    return detalleDe(c, s.id);
  });
}

// ---- listados ---------------------------------------------------------------------------------

const listadoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ESTADOS).optional(),
  priority: z.enum(PRIORIDADES).optional(),
  zone: z.enum(ZONAS).optional(),
});

export function validarPaginacion(query: unknown) {
  const r = listadoSchema.safeParse(query);
  if (!r.success) {
    const e = primerErrorDe(r.error);
    throw validacion(e.campo, `Parametro invalido: ${e.campo || 'consulta'}.`);
  }
  return r.data;
}

export interface Pagina<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

export async function listarSolicitudes(
  pool: Pool,
  user: UsuarioSesion,
  query: unknown,
): Promise<
  Pagina<{ code: string; zone: string; priority: string; status: Estado; requiredDate: string }>
> {
  const q = validarPaginacion(query);
  const params: unknown[] = [user.orgId];
  let donde = 'org_id = $1';
  if (user.role === 'SOLICITANTE') {
    params.push(user.id);
    donde += ` AND requester_id = $${params.length}`;
  }
  // Columnas de una lista cerrada del codigo: nunca texto del usuario.
  const filtros: [string, string | undefined][] = [
    ['status', q.status],
    ['priority', q.priority],
    ['zone', q.zone],
  ];
  for (const [columna, valor] of filtros) {
    if (valor) {
      params.push(valor);
      donde += ` AND ${columna} = $${params.length}`;
    }
  }
  const total = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM requests WHERE ${donde}`,
    params,
  );
  params.push(q.pageSize, (q.page - 1) * q.pageSize);
  const items = await pool.query<{
    code: string;
    zone: string;
    priority: string;
    status: Estado;
    required_date: Date;
  }>(
    `SELECT code, zone, priority, status, required_date FROM requests
      WHERE ${donde} ORDER BY created_at DESC, id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    page: q.page,
    pageSize: q.pageSize,
    total: total.rows[0]!.n,
    items: items.rows.map((r) => ({
      code: r.code,
      zone: r.zone,
      priority: r.priority,
      status: r.status,
      requiredDate: r.required_date.toISOString(),
    })),
  };
}

export async function tablero(pool: Pool, user: UsuarioSesion) {
  const params: unknown[] = [user.orgId];
  let donde = 'org_id = $1';
  if (user.role === 'SOLICITANTE') {
    params.push(user.id);
    donde += ` AND requester_id = $${params.length}`;
  }
  const r = await pool.query<{ status: Estado; n: number }>(
    `SELECT status, count(*)::int AS n FROM requests WHERE ${donde} GROUP BY status`,
    params,
  );
  const byStatus = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<Estado, number>;
  for (const f of r.rows) byStatus[f.status] = f.n;
  if (user.role === 'SOLICITANTE') return { byStatus };
  return { byStatus, inventory: await inventarioDe(pool, user.orgId) };
}

export async function inventarioDe(c: Conexion, orgId: string) {
  const r = await c.query<{ sku: string; name: string; on_hand: number; reserved: number }>(
    `SELECT s.code AS sku, s.name, i.on_hand, i.reserved
       FROM inventory i JOIN skus s ON s.id = i.sku_id WHERE i.org_id = $1 ORDER BY s.code`,
    [orgId],
  );
  return r.rows.map((f) => ({
    sku: f.sku,
    name: f.name,
    onHand: f.on_hand,
    reserved: f.reserved,
    available: f.on_hand - f.reserved,
  }));
}

export async function listarAuditoria(pool: Pool, user: UsuarioSesion, query: unknown) {
  const q = validarPaginacion({
    page: (query as Record<string, unknown>)?.page,
    pageSize: (query as Record<string, unknown>)?.pageSize,
  });
  const total = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM audit_events WHERE org_id = $1',
    [user.orgId],
  );
  const r = await pool.query<{
    id: string;
    occurred_at: Date;
    user_id: number;
    org_id: string;
    resource_type: string;
    resource_id: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    correlation_id: string;
  }>(
    `SELECT id, occurred_at, user_id, org_id, resource_type, resource_id, action, from_status,
            to_status, correlation_id
       FROM audit_events WHERE org_id = $1
      ORDER BY occurred_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [user.orgId, q.pageSize, (q.page - 1) * q.pageSize],
  );
  return {
    page: q.page,
    pageSize: q.pageSize,
    total: total.rows[0]!.n,
    items: r.rows.map((f) => ({
      id: Number(f.id),
      occurredAt: f.occurred_at.toISOString(),
      userId: f.user_id,
      orgId: f.org_id,
      resourceType: f.resource_type,
      resourceId: f.resource_id,
      action: f.action,
      fromStatus: f.from_status,
      toStatus: f.to_status,
      correlationId: f.correlation_id,
    })),
  };
}
