// Errores de la API con el formato uniforme { error, mensaje, campo, correlationId }.
import type { ErrorRequestHandler, Request } from 'express';

export type CodigoError =
  | 'NO_AUTENTICADO'
  | 'CREDENCIALES_INVALIDAS'
  | 'PROHIBIDO'
  | 'NO_ENCONTRADA'
  | 'VALIDACION'
  | 'JSON_INVALIDO'
  | 'ESTADO_INVALIDO'
  | 'STOCK_INSUFICIENTE'
  | 'LLAVE_REQUERIDA'
  | 'LLAVE_CON_OTRO_CONTENIDO'
  | 'RESUMEN_YA_APROBADO'
  | 'ERROR_INTERNO';

const ESTADO_HTTP: Record<CodigoError, number> = {
  NO_AUTENTICADO: 401,
  CREDENCIALES_INVALIDAS: 401,
  PROHIBIDO: 403,
  NO_ENCONTRADA: 404,
  VALIDACION: 422,
  JSON_INVALIDO: 400,
  ESTADO_INVALIDO: 409,
  STOCK_INSUFICIENTE: 409,
  LLAVE_REQUERIDA: 400,
  LLAVE_CON_OTRO_CONTENIDO: 409,
  RESUMEN_YA_APROBADO: 409,
  ERROR_INTERNO: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly campo: string | null = null,
  ) {
    super(mensaje);
    this.status = ESTADO_HTTP[codigo];
  }
}

export const noEncontrada = () => new AppError('NO_ENCONTRADA', 'No se encontro el recurso.');
export const estadoInvalido = (
  mensaje = 'La solicitud no esta en un estado que permita esta operacion.',
) => new AppError('ESTADO_INVALIDO', mensaje);
export const validacion = (campo: string, mensaje: string) =>
  new AppError('VALIDACION', mensaje, campo);

export function cuerpoDeError(e: AppError, correlationId: string) {
  return { error: e.codigo, mensaje: e.message, campo: e.campo, correlationId };
}

/** Manejador final. Un error inesperado responde 500 sin trazas ni detalles tecnicos. */
export const manejadorDeErrores: ErrorRequestHandler = (err, req: Request, res, next) => {
  void next;
  const correlationId = req.correlationId ?? 'sin-correlacion';
  if (err instanceof AppError) {
    res.status(err.status).json(cuerpoDeError(err, correlationId));
    return;
  }
  const tipo = (err as { type?: string } | null)?.type;
  if (tipo === 'entity.parse.failed' || tipo === 'entity.too.large') {
    const e = new AppError('JSON_INVALIDO', 'El cuerpo de la peticion no es JSON valido.');
    res.status(e.status).json(cuerpoDeError(e, correlationId));
    return;
  }
  // Solo el mensaje tecnico va al log (que redacta secretos); nunca a la respuesta.
  req.log?.error(
    { err: { message: (err as Error)?.message, name: (err as Error)?.name } },
    'error inesperado',
  );
  const e = new AppError('ERROR_INTERNO', 'Ocurrio un error inesperado. Intente de nuevo.');
  res.status(e.status).json(cuerpoDeError(e, correlationId));
};
