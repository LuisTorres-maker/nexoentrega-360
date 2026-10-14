import type { Logger } from 'pino';
import type { Role } from '../domain/enums';

export interface UsuarioSesion {
  id: number;
  orgId: string;
  role: Role;
  email: string;
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      log: Logger;
      user?: UsuarioSesion;
    }
  }
}

export {};
