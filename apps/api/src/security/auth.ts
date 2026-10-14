// Autenticacion con sesion opaca (ADR-0003). Rol y organizacion salen de la base, nunca del cliente.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Role } from '../domain/enums';
import { AppError } from '../http/errors';
import type { UsuarioSesion } from '../http/types';
import { primerErrorDe } from '../domain/request-schema';

export const sha256 = (texto: string): string =>
  crypto.createHash('sha256').update(texto).digest('hex');

// Hash de relleno: el tiempo de respuesta no distingue cuenta inexistente de clave erronea.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-es-una-clave', 10);

const loginSchema = z.strictObject({
  email: z.string().min(1),
  password: z.string().min(1),
});

export interface ResultadoLogin {
  token: string;
  user: { id: number; role: Role; orgId: string };
}

export async function iniciarSesion(
  pool: Pool,
  ahora: Date,
  horas: number,
  cuerpo: unknown,
): Promise<ResultadoLogin> {
  const r = loginSchema.safeParse(cuerpo);
  if (!r.success) {
    const e = primerErrorDe(r.error);
    throw new AppError('VALIDACION', e.mensaje, e.campo || null);
  }
  const { rows } = await pool.query<{
    id: number;
    org_id: string;
    role: Role;
    password_hash: string;
  }>('SELECT id, org_id, role, password_hash FROM users WHERE email = $1', [
    r.data.email.trim().toLowerCase(),
  ]);
  const cuenta = rows[0];
  const ok = await bcrypt.compare(r.data.password, cuenta?.password_hash ?? HASH_RELLENO);
  if (!cuenta || !ok) {
    throw new AppError('CREDENCIALES_INVALIDAS', 'Correo o contrasena incorrectos.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const vence = new Date(ahora.getTime() + horas * 3_600_000);
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [sha256(token), cuenta.id, ahora, vence],
  );
  return { token, user: { id: cuenta.id, role: cuenta.role, orgId: cuenta.org_id } };
}

export function tokenDe(req: Request): string | null {
  const h = req.header('authorization') ?? '';
  const m = /^Bearer ([A-Za-z0-9]{16,128})$/.exec(h);
  return m?.[1] ?? null;
}

export function authenticate(pool: Pool, reloj: () => Date) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = tokenDe(req);
      if (!token) throw new AppError('NO_AUTENTICADO', 'Debe iniciar sesion.');
      const { rows } = await pool.query<{
        id: number;
        org_id: string;
        role: Role;
        email: string;
        display_name: string;
      }>(
        `SELECT u.id, u.org_id, u.role, u.email, u.display_name
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > $2`,
        [sha256(token), reloj()],
      );
      const u = rows[0];
      if (!u) throw new AppError('NO_AUTENTICADO', 'Debe iniciar sesion.');
      const usuario: UsuarioSesion = {
        id: u.id,
        orgId: u.org_id,
        role: u.role,
        email: u.email,
        displayName: u.display_name,
      };
      req.user = usuario;
      next();
    } catch (e) {
      next(e);
    }
  };
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('PROHIBIDO', 'Su rol no permite esta operacion.'));
      return;
    }
    next();
  };

export async function cerrarSesion(pool: Pool, token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}
