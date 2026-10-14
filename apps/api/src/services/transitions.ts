// Transiciones de estado con efectos atomicos sobre el inventario (ADR-0002).
// Una sola transaccion por operacion: estado + inventario + auditoria + llave de idempotencia.
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { TRANSICIONES, puedeTransitar, type Accion, type Estado } from '../domain/enums';
import { fechaValidaParaEnvio } from '../domain/request-schema';
import { AppError, estadoInvalido, noEncontrada, validacion } from '../http/errors';
import type { UsuarioSesion } from '../http/types';
import { buscarSolicitud, detalleDe, resolverSkus, type DetalleSolicitud } from './requests';

export interface ContextoOperacion {
  user: UsuarioSesion;
  correlationId: string;
  ahora: Date;
}

/** Ganchos solo para pruebas (inyeccion de fallos). En produccion no se pasan. */
export interface GanchosDePrueba {
  despuesDeLineaReservada?: (indice: number) => void | Promise<void>;
}

export interface ResultadoTransicion {
  cuerpo: DetalleSolicitud;
  repetida: boolean;
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const RETENCION_MS = 24 * 3_600_000;

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

async function auditar(
  c: PoolClient,
  ctx: ContextoOperacion,
  codigo: string,
  accion: Accion,
  desde: Estado,
  hacia: Estado,
): Promise<void> {
  await c.query(
    `INSERT INTO audit_events (occurred_at, user_id, org_id, resource_type, resource_id, action,
                               from_status, to_status, correlation_id)
     VALUES ($1, $2, $3, 'REQUEST', $4, $5, $6, $7, $8)`,
    [ctx.ahora, ctx.user.id, ctx.user.orgId, codigo, accion, desde, hacia, ctx.correlationId],
  );
}

async function cambiarEstado(c: PoolClient, id: number, hacia: Estado, ahora: Date): Promise<void> {
  await c.query('UPDATE requests SET status = $1, updated_at = $2 WHERE id = $3', [
    hacia,
    ahora,
    id,
  ]);
}

/** BORRADOR -> ENVIADA. Revalida SKU activos y fecha contra el reloj (RF03). */
export async function enviar(
  pool: Pool,
  ctx: ContextoOperacion,
  code: string,
): Promise<DetalleSolicitud> {
  const existe = await buscarSolicitud(pool, ctx.user, code);
  if (!existe) throw noEncontrada();
  return enTransaccion(pool, async (c) => {
    const s = await buscarSolicitud(c, ctx.user, code, { bloquear: true });
    if (!s) throw noEncontrada();
    if (!puedeTransitar('ENVIAR', s.status)) throw estadoInvalido();
    const det = await detalleDe(c, s.id);
    if (det.lines.length < 1 || det.lines.length > 10) {
      throw validacion('lines', 'La solicitud debe tener de 1 a 10 lineas.');
    }
    await resolverSkus(c, det.lines);
    if (!fechaValidaParaEnvio(det.requiredDate, ctx.ahora)) {
      throw validacion(
        'requiredDate',
        'La fecha requerida no puede ser anterior al momento de envio.',
      );
    }
    await cambiarEstado(c, s.id, 'ENVIADA', ctx.ahora);
    await auditar(c, ctx, s.code, 'ENVIAR', s.status, 'ENVIADA');
    return detalleDe(c, s.id);
  });
}

/** RESERVAR: todo o nada, con idempotencia (RF05, RF07). */
export async function reservar(
  pool: Pool,
  ctx: ContextoOperacion,
  code: string,
  llave: string | undefined,
  ganchos: GanchosDePrueba = {},
): Promise<ResultadoTransicion> {
  // Orden de controles: 404 (recurso) antes que 400 (encabezado), ver SPEC-003.
  const existe = await buscarSolicitud(pool, ctx.user, code);
  if (!existe) throw noEncontrada();
  const k = (llave ?? '').trim();
  if (k.length === 0) {
    throw new AppError(
      'LLAVE_REQUERIDA',
      'Falta el encabezado Idempotency-Key.',
      'Idempotency-Key',
    );
  }
  if (k.length > 128) {
    throw validacion('Idempotency-Key', 'La llave de idempotencia admite hasta 128 caracteres.');
  }
  const hash = sha(JSON.stringify({ operation: 'RESERVE', requestCode: code }));
  const { orgId, id: userId } = ctx.user;

  return enTransaccion(pool, async (c): Promise<ResultadoTransicion> => {
    // 1) Repeticiones simultaneas con la misma llave hacen fila.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${orgId}:${userId}:RESERVE:${k}`,
    ]);
    // 2) La llave ya se proceso con exito? (retencion minima de 24 horas)
    const prev = await c.query<{ request_hash: string; response_body: DetalleSolicitud }>(
      `SELECT request_hash, response_body FROM idempotency_keys
        WHERE org_id = $1 AND user_id = $2 AND operation = 'RESERVE' AND key = $3 AND created_at > $4`,
      [orgId, userId, k, new Date(ctx.ahora.getTime() - RETENCION_MS)],
    );
    const guardada = prev.rows[0];
    if (guardada) {
      if (guardada.request_hash !== hash) {
        throw new AppError(
          'LLAVE_CON_OTRO_CONTENIDO',
          'La llave ya se uso con otra solicitud.',
          'Idempotency-Key',
        );
      }
      return { cuerpo: guardada.response_body, repetida: true };
    }
    // 3) Bloquear la solicitud (solo de mi organizacion) y exigir ENVIADA.
    const s = await buscarSolicitud(c, ctx.user, code, { bloquear: true });
    if (!s) throw noEncontrada();
    if (!puedeTransitar('RESERVAR', s.status)) throw estadoInvalido();
    // 4) Reservar cada linea en orden fijo de SKU; si una falla se deshace todo.
    const lineas = await c.query<{ sku_id: number; quantity: number; code: string }>(
      `SELECT l.sku_id, l.quantity, k.code FROM request_lines l JOIN skus k ON k.id = l.sku_id
        WHERE l.request_id = $1 ORDER BY l.sku_id`,
      [s.id],
    );
    for (const [i, l] of lineas.rows.entries()) {
      const u = await c.query(
        `UPDATE inventory SET reserved = reserved + $1
          WHERE org_id = $2 AND sku_id = $3 AND on_hand - reserved >= $1`,
        [l.quantity, orgId, l.sku_id],
      );
      if (u.rowCount === 0) {
        throw new AppError(
          'STOCK_INSUFICIENTE',
          `No hay disponible suficiente de ${l.code}.`,
          `lines.${i}`,
        );
      }
      await ganchos.despuesDeLineaReservada?.(i);
    }
    // 5) Estado, auditoria y llave, en la misma transaccion.
    await cambiarEstado(c, s.id, 'RESERVADA', ctx.ahora);
    await auditar(c, ctx, s.code, 'RESERVAR', s.status, 'RESERVADA');
    const cuerpo = await detalleDe(c, s.id);
    await c.query(
      `INSERT INTO idempotency_keys (org_id, user_id, operation, key, request_hash, status_code,
                                     response_body, created_at)
       VALUES ($1, $2, 'RESERVE', $3, $4, 200, $5, $6)
       ON CONFLICT (org_id, user_id, operation, key) DO UPDATE
         SET request_hash = EXCLUDED.request_hash, status_code = 200,
             response_body = EXCLUDED.response_body, created_at = EXCLUDED.created_at`,
      [orgId, userId, k, hash, JSON.stringify(cuerpo), ctx.ahora],
    );
    return { cuerpo, repetida: false };
  });
}

/** Cancelar (dueno): libera la reserva si estaba RESERVADA (RF06). */
export async function cancelar(
  pool: Pool,
  ctx: ContextoOperacion,
  code: string,
): Promise<DetalleSolicitud> {
  const existe = await buscarSolicitud(pool, ctx.user, code, { soloDueno: true });
  if (!existe) throw noEncontrada();
  return enTransaccion(pool, async (c) => {
    const s = await buscarSolicitud(c, ctx.user, code, { bloquear: true, soloDueno: true });
    if (!s) throw noEncontrada();
    if (!puedeTransitar('CANCELAR', s.status)) throw estadoInvalido();
    if (s.status === 'RESERVADA') {
      await c.query(
        `UPDATE inventory i SET reserved = i.reserved - l.quantity
           FROM request_lines l
          WHERE l.request_id = $1 AND i.org_id = $2 AND i.sku_id = l.sku_id`,
        [s.id, ctx.user.orgId],
      );
    }
    await cambiarEstado(c, s.id, TRANSICIONES.CANCELAR.hacia, ctx.ahora);
    await auditar(c, ctx, s.code, 'CANCELAR', s.status, 'CANCELADA');
    return detalleDe(c, s.id);
  });
}

/** Despachar (bodega): baja la existencia fisica y lo reservado (RF06). */
export async function despachar(
  pool: Pool,
  ctx: ContextoOperacion,
  code: string,
): Promise<DetalleSolicitud> {
  const existe = await buscarSolicitud(pool, ctx.user, code);
  if (!existe) throw noEncontrada();
  return enTransaccion(pool, async (c) => {
    const s = await buscarSolicitud(c, ctx.user, code, { bloquear: true });
    if (!s) throw noEncontrada();
    if (!puedeTransitar('DESPACHAR', s.status)) throw estadoInvalido();
    await c.query(
      `UPDATE inventory i SET on_hand = i.on_hand - l.quantity, reserved = i.reserved - l.quantity
         FROM request_lines l
        WHERE l.request_id = $1 AND i.org_id = $2 AND i.sku_id = l.sku_id`,
      [s.id, ctx.user.orgId],
    );
    await cambiarEstado(c, s.id, 'DESPACHADA', ctx.ahora);
    await auditar(c, ctx, s.code, 'DESPACHAR', s.status, 'DESPACHADA');
    return detalleDe(c, s.id);
  });
}

/** Entregar (coordinador): no toca el inventario. */
export async function entregar(
  pool: Pool,
  ctx: ContextoOperacion,
  code: string,
): Promise<DetalleSolicitud> {
  const existe = await buscarSolicitud(pool, ctx.user, code);
  if (!existe) throw noEncontrada();
  return enTransaccion(pool, async (c) => {
    const s = await buscarSolicitud(c, ctx.user, code, { bloquear: true });
    if (!s) throw noEncontrada();
    if (!puedeTransitar('ENTREGAR', s.status)) throw estadoInvalido();
    await cambiarEstado(c, s.id, 'ENTREGADA', ctx.ahora);
    await auditar(c, ctx, s.code, 'ENTREGAR', s.status, 'ENTREGADA');
    return detalleDe(c, s.id);
  });
}
