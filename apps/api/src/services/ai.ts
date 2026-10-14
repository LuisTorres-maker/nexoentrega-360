// Rutas de resumen: validacion de entrada, llamada al adaptador con solo campos autorizados,
// guardado del intento y aprobacion unica con auditoria (RF10, RF11, RF12).
import type { Pool } from 'pg';
import { z } from 'zod';
import { generarResumen, type AiProvider, type ItemEntradaIA } from '../ai/ai';
import { AppError, noEncontrada, validacion } from '../http/errors';
import type { UsuarioSesion } from '../http/types';

const entradaSchema = z.strictObject({
  requestIds: z.array(z.string().min(1)).min(1).max(20),
});

export interface OpcionesIA {
  proveedor: AiProvider | null;
  timeoutMs?: number;
}

export async function crearResumen(
  pool: Pool,
  user: UsuarioSesion,
  correlationId: string,
  cuerpo: unknown,
  opciones: OpcionesIA,
) {
  const r = entradaSchema.safeParse(cuerpo);
  if (!r.success) {
    const campo = r.error.issues[0]?.path.map(String).join('.') || 'requestIds';
    throw validacion(campo, 'Indique de 1 a 20 codigos de solicitud en requestIds.');
  }
  const ids = r.data.requestIds;
  if (new Set(ids).size !== ids.length) {
    throw validacion('requestIds', 'Los codigos de solicitud no pueden repetirse.');
  }
  // Solo solicitudes de MI organizacion (404 si alguna falta o es ajena), antes de llamar al proveedor.
  const { rows } = await pool.query<{
    code: string;
    zone: string;
    priority: 'NORMAL' | 'ALTA';
    required_date: Date;
    status: string;
    notes: string | null;
  }>(
    `SELECT code, zone, priority, required_date, status, notes
       FROM requests WHERE org_id = $1 AND code = ANY($2)`,
    [user.orgId, ids],
  );
  if (rows.length !== ids.length) throw noEncontrada();
  if (rows.some((f) => f.status !== 'ENVIADA')) {
    throw new AppError('ESTADO_INVALIDO', 'Todas las solicitudes deben estar en estado ENVIADA.');
  }
  const porCodigo = new Map(rows.map((f) => [f.code, f]));
  // Solo los seis campos autorizados (RF10): nunca solicitante, contrasenas ni sesiones.
  const items: ItemEntradaIA[] = ids.map((code) => {
    const f = porCodigo.get(code)!;
    return {
      requestId: f.code,
      zona: f.zone,
      prioridad: f.priority,
      fechaRequerida: f.required_date.toISOString(),
      estado: 'ENVIADA',
      observaciones: f.notes,
    };
  });
  const g = await generarResumen(opciones.proveedor, items, opciones.timeoutMs);
  const ins = await pool.query<{ id: number }>(
    `INSERT INTO ai_summary_attempts (org_id, user_id, request_ids, source, outcome, notice, summary,
                                      correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      user.orgId,
      user.id,
      ids,
      g.origen,
      g.motivo,
      g.aviso,
      JSON.stringify(g.resultado),
      correlationId,
    ],
  );
  return {
    id: ins.rows[0]!.id,
    origen: g.origen,
    generadoConIA: g.generadoConIA,
    estado: 'BORRADOR' as const,
    aviso: g.aviso,
    resultado: g.resultado,
  };
}

export async function aprobarResumen(
  pool: Pool,
  user: UsuarioSesion,
  correlationId: string,
  ahora: Date,
  idTexto: string,
) {
  const id = /^[0-9]{1,9}$/.test(idTexto) ? Number(idTexto) : null;
  if (id === null) throw noEncontrada();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const f = await c.query<{ approved_at: Date | null }>(
      'SELECT approved_at FROM ai_summary_attempts WHERE id = $1 AND org_id = $2 FOR UPDATE',
      [id, user.orgId],
    );
    const fila = f.rows[0];
    if (!fila) throw noEncontrada();
    if (fila.approved_at) {
      throw new AppError('RESUMEN_YA_APROBADO', 'Este resumen ya fue aprobado.');
    }
    await c.query(
      'UPDATE ai_summary_attempts SET approved_by = $1, approved_at = $2 WHERE id = $3',
      [user.id, ahora, id],
    );
    await c.query(
      `INSERT INTO audit_events (occurred_at, user_id, org_id, resource_type, resource_id, action,
                                 from_status, to_status, correlation_id)
       VALUES ($1, $2, $3, 'AI_SUMMARY', $4, 'APROBAR_RESUMEN', 'BORRADOR', 'APROBADO', $5)`,
      [ahora, user.id, user.orgId, String(id), correlationId],
    );
    await c.query('COMMIT');
    return { id, aprobadoPor: user.id, aprobadoEn: ahora.toISOString() };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
