// Cliente de la API. El token vive solo en sessionStorage. Ninguna decision de permisos se toma aqui.

export type Rol = 'SOLICITANTE' | 'COORDINADOR' | 'BODEGA' | 'AUDITOR';
export type Estado =
  'BORRADOR' | 'ENVIADA' | 'RESERVADA' | 'DESPACHADA' | 'ENTREGADA' | 'CANCELADA';

export interface Sesion {
  token: string;
  rol: Rol;
  orgId: string;
  nombre: string;
  correo: string;
}

export interface Resumen {
  code: string;
  zone: string;
  priority: 'NORMAL' | 'ALTA';
  status: Estado;
  requiredDate: string;
}

export interface Detalle extends Resumen {
  notes: string | null;
  requesterName: string;
  lines: { sku: string; quantity: number }[];
}

export interface Pagina<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface ItemInventario {
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface Tablero {
  byStatus: Record<Estado, number>;
  inventory?: ItemInventario[];
}

export interface EventoAuditoria {
  id: number;
  occurredAt: string;
  userId: number;
  orgId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  correlationId: string;
}

export interface ResumenIA {
  id: number;
  origen: 'PROVEEDOR' | 'ALTERNATIVO';
  generadoConIA: boolean;
  estado: 'BORRADOR';
  aviso: string | null;
  resultado: {
    summary: string;
    recommendations: { requestId: string; reason: string; evidenceFields: string[] }[];
  };
}

export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
    readonly campo: string | null,
  ) {
    super(mensaje);
  }
}

const CLAVE = 'nexo.sesion';

export function leerSesion(): Sesion | null {
  try {
    const t = sessionStorage.getItem(CLAVE);
    return t ? (JSON.parse(t) as Sesion) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion | null): void {
  try {
    if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // sessionStorage no disponible: la sesion vive solo en memoria de la pagina
  }
}

/** Mensaje comprensible por codigo HTTP (401, 403, 404, 409, 422). */
export function mensajeParaUsuario(e: unknown): string {
  if (!(e instanceof ErrorApi)) return 'No se pudo conectar con el servidor. Intente de nuevo.';
  switch (e.status) {
    case 401:
      return e.codigo === 'CREDENCIALES_INVALIDAS'
        ? 'Correo o contraseña incorrectos.'
        : 'Su sesión no es válida o venció. Inicie sesión de nuevo.';
    case 403:
      return 'Su rol no permite esta operación.';
    case 404:
      return 'No se encontró la solicitud.';
    case 409:
      return e.message || 'La operación no es posible en el estado actual.';
    case 422:
      return e.message || 'Hay datos inválidos en el formulario.';
    default:
      return e.message || 'Ocurrió un error inesperado.';
  }
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH';
  cuerpo?: unknown;
  llave?: string;
  consulta?: Record<string, string | number | undefined>;
}

function interpretar(texto: string): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export async function llamar<T>(ruta: string, o: Opciones = {}): Promise<T> {
  const sesion = leerSesion();
  const url = new URL('/api' + ruta, window.location.origin);
  for (const [k, v] of Object.entries(o.consulta ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const cabeceras: Record<string, string> = {};
  if (o.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (sesion) cabeceras.Authorization = `Bearer ${sesion.token}`;
  if (o.llave) cabeceras['Idempotency-Key'] = o.llave;
  const r = await fetch(url, {
    method: o.metodo ?? 'GET',
    headers: cabeceras,
    body: o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined,
  });
  const texto = await r.text();
  const datos = interpretar(texto);
  if (!r.ok) {
    const d = (datos ?? {}) as { error?: string; mensaje?: string; campo?: string | null };
    if (r.status === 401 && sesion && d.error === 'NO_AUTENTICADO') {
      guardarSesion(null);
      window.dispatchEvent(new Event('nexo:sesion-vencida'));
    }
    throw new ErrorApi(r.status, d.error ?? 'ERROR', d.mensaje ?? '', d.campo ?? null);
  }
  return datos as T;
}

export async function iniciarSesion(correo: string, clave: string): Promise<Sesion> {
  const r = await llamar<{ token: string; user: { id: number; role: Rol; orgId: string } }>(
    '/auth/login',
    { metodo: 'POST', cuerpo: { email: correo, password: clave } },
  );
  const sesion: Sesion = {
    token: r.token,
    rol: r.user.role,
    orgId: r.user.orgId,
    nombre: correo,
    correo,
  };
  guardarSesion(sesion);
  try {
    const me = await llamar<{ displayName: string }>('/me');
    sesion.nombre = me.displayName;
    guardarSesion(sesion);
  } catch {
    // el nombre es opcional
  }
  return sesion;
}

export async function cerrarSesion(): Promise<void> {
  try {
    await llamar('/auth/logout', { metodo: 'POST', cuerpo: {} });
  } catch {
    // aunque falle, la sesion local se descarta
  }
  guardarSesion(null);
}
