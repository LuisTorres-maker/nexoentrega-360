// Fabrica de la aplicacion: recibe sus dependencias para probarla con la base de pruebas,
// un reloj controlado y ganchos de fallo (solo pruebas).
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import pino, { type Logger } from 'pino';
import type { AiProvider } from './ai/ai';
import { AppError, manejadorDeErrores } from './http/errors';
import { aprobarResumen, crearResumen } from './services/ai';
import { authenticate, cerrarSesion, iniciarSesion, requireRole, tokenDe } from './security/auth';
import {
  crearBorrador,
  detallePorCodigo,
  editarBorrador,
  inventarioDe,
  listarAuditoria,
  listarSolicitudes,
  tablero,
} from './services/requests';
import {
  cancelar,
  despachar,
  entregar,
  enviar,
  reservar,
  type ContextoOperacion,
  type GanchosDePrueba,
} from './services/transitions';

export interface DependenciasApp {
  pool: Pool;
  /** Reloj inyectable; por defecto la hora real. */
  clock?: () => Date;
  sessionHours?: number;
  logger?: Logger;
  ganchosDePrueba?: GanchosDePrueba;
  /** Proveedor de IA; null o ausente = modo apagado (siempre resumen alternativo). */
  aiProvider?: AiProvider | null;
  aiTimeoutMs?: number;
}

type Manejador = (req: Request, res: Response) => Promise<void>;
const asincrono =
  (f: Manejador) =>
  (req: Request, res: Response, next: NextFunction): void => {
    f(req, res).catch(next);
  };

const REDACTAR = [
  'req.headers.authorization',
  'headers.authorization',
  '*.password',
  '*.token',
  '*.password_hash',
];

export function createApp(deps: DependenciasApp) {
  const { pool } = deps;
  const clock = deps.clock ?? (() => new Date());
  const horas = deps.sessionHours ?? 8;
  const logger = deps.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info', redact: REDACTAR });
  const json = express.json({ limit: '100kb', strict: true });
  const auth = authenticate(pool, clock);

  const app = express();
  app.disable('x-powered-by');

  // 1) correlationId y log (siempre ocurre, aun en peticiones rechazadas)
  app.use((req, res, next) => {
    const recibido = req.header('x-correlation-id');
    const id = recibido && /^[A-Za-z0-9._-]{1,64}$/.test(recibido) ? recibido : crypto.randomUUID();
    req.correlationId = id;
    res.setHeader('x-correlation-id', id);
    req.log = logger.child({ correlationId: id });
    res.on('finish', () => {
      req.log.info({ method: req.method, path: req.path, status: res.statusCode }, 'peticion');
    });
    next();
  });

  // Salud (publicos)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get(
    '/ready',
    asincrono(async (_req, res) => {
      try {
        await pool.query('SELECT 1');
        res.json({ status: 'ready' });
      } catch {
        res.status(503).json({ status: 'no-listo', razon: 'base de datos' });
      }
    }),
  );

  // Sesion
  app.post(
    '/auth/login',
    json,
    asincrono(async (req, res) => {
      const r = await iniciarSesion(pool, clock(), horas, req.body);
      res.json(r);
    }),
  );
  app.post(
    '/auth/logout',
    auth,
    asincrono(async (req, res) => {
      const token = tokenDe(req);
      if (token) await cerrarSesion(pool, token);
      res.json({ ok: true });
    }),
  );
  app.get('/me', auth, (req, res) => {
    const u = req.user!;
    res.json({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      orgId: u.orgId,
    });
  });

  const ctx = (req: Request): ContextoOperacion => ({
    user: req.user!,
    correlationId: req.correlationId,
    ahora: clock(),
  });

  // Solicitudes
  app.post(
    '/requests',
    auth,
    requireRole('SOLICITANTE'),
    json,
    asincrono(async (req, res) => {
      res.status(201).json(await crearBorrador(pool, clock(), req.user!, req.body));
    }),
  );
  app.get(
    '/requests',
    auth,
    asincrono(async (req, res) => {
      res.json(await listarSolicitudes(pool, req.user!, req.query));
    }),
  );
  app.get(
    '/requests/:code',
    auth,
    asincrono(async (req, res) => {
      res.json(await detallePorCodigo(pool, req.user!, String(req.params.code)));
    }),
  );
  app.patch(
    '/requests/:code',
    auth,
    requireRole('SOLICITANTE'),
    json,
    asincrono(async (req, res) => {
      res.json(await editarBorrador(pool, clock(), req.user!, String(req.params.code), req.body));
    }),
  );

  // Transiciones
  app.post(
    '/requests/:code/submit',
    auth,
    requireRole('SOLICITANTE'),
    asincrono(async (req, res) => {
      res.json(await enviar(pool, ctx(req), String(req.params.code)));
    }),
  );
  app.post(
    '/requests/:code/reserve',
    auth,
    requireRole('COORDINADOR'),
    asincrono(async (req, res) => {
      const r = await reservar(
        pool,
        ctx(req),
        String(req.params.code),
        req.header('idempotency-key'),
        deps.ganchosDePrueba,
      );
      if (r.repetida) res.setHeader('Idempotent-Replay', 'true');
      res.json(r.cuerpo);
    }),
  );
  app.post(
    '/requests/:code/dispatch',
    auth,
    requireRole('BODEGA'),
    asincrono(async (req, res) => {
      res.json(await despachar(pool, ctx(req), String(req.params.code)));
    }),
  );
  app.post(
    '/requests/:code/deliver',
    auth,
    requireRole('COORDINADOR'),
    asincrono(async (req, res) => {
      res.json(await entregar(pool, ctx(req), String(req.params.code)));
    }),
  );
  app.post(
    '/requests/:code/cancel',
    auth,
    requireRole('SOLICITANTE'),
    asincrono(async (req, res) => {
      res.json(await cancelar(pool, ctx(req), String(req.params.code)));
    }),
  );

  // Consultas
  app.get(
    '/dashboard',
    auth,
    asincrono(async (req, res) => {
      res.json(await tablero(pool, req.user!));
    }),
  );
  app.get(
    '/inventory',
    auth,
    requireRole('COORDINADOR', 'BODEGA', 'AUDITOR'),
    asincrono(async (req, res) => {
      res.json({ items: await inventarioDe(pool, req.user!.orgId) });
    }),
  );
  app.get(
    '/audit',
    auth,
    requireRole('COORDINADOR', 'AUDITOR'),
    asincrono(async (req, res) => {
      res.json(await listarAuditoria(pool, req.user!, req.query));
    }),
  );

  // Asistente de IA (solo COORDINADOR; el auditor y los demas roles reciben 403)
  app.post(
    '/ai/summaries',
    auth,
    requireRole('COORDINADOR'),
    json,
    asincrono(async (req, res) => {
      res.json(
        await crearResumen(pool, req.user!, req.correlationId, req.body, {
          proveedor: deps.aiProvider ?? null,
          timeoutMs: deps.aiTimeoutMs,
        }),
      );
    }),
  );
  app.post(
    '/ai/summaries/:id/approve',
    auth,
    requireRole('COORDINADOR'),
    asincrono(async (req, res) => {
      res.json(
        await aprobarResumen(pool, req.user!, req.correlationId, clock(), String(req.params.id)),
      );
    }),
  );

  // Cualquier otra ruta: 404 con el formato uniforme (tambien PUT/PATCH/DELETE sobre /audit).
  app.use((_req, _res, next) => {
    next(new AppError('NO_ENCONTRADA', 'No se encontro el recurso.'));
  });
  app.use(manejadorDeErrores);
  return app;
}
