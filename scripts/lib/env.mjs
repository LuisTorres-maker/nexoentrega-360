// Utilidades comunes de los scripts de base de datos. Nunca imprimen la URL ni la clave.
import { config } from 'dotenv';
import pg from 'pg';

config({ quiet: true });

/** Datos de conexion tomados de las variables de entorno (sin imprimirlos). */
export function configDesdeEntorno(nombreVariable) {
  const url = process.env[nombreVariable];
  if (!url) return { url: null, ssl: false };
  const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
  return { url, ssl };
}

export function crearPool({ url, ssl }) {
  return new pg.Pool({ connectionString: url, ssl, max: 1, connectionTimeoutMillis: 10000 });
}

/** Quita host, usuario y clave de un texto de error antes de mostrarlo. */
export function limpiarMensaje(texto, url) {
  let salida = String(texto ?? '');
  try {
    const u = new URL(url);
    const secretos = [u.password, decodeURIComponent(u.password), u.hostname, u.username];
    for (const secreto of secretos) {
      if (secreto) salida = salida.split(secreto).join('<oculto>');
    }
  } catch {
    // URL ilegible: no hay nada que ocultar de forma fiable.
  }
  return salida.replace(/postgres(ql)?:\/\/\S+/gi, '<url-oculta>');
}

/** true si la URL apunta a Supabase (no se migra ni se siembra desde aqui). */
export function esSupabase(url) {
  return /supabase\.(co|com)/i.test(url ?? '');
}

export const AYUDA_CONEXION = {
  ENOTFOUND:
    'El nombre del servidor no se resolvio. La conexion directa de Supabase usa IPv6: use la cadena "Session pooler".',
  ENETUNREACH:
    'Red inalcanzable (suele ser IPv6). Use la cadena "Session pooler" de Supabase (Connect > Session pooler).',
  ETIMEDOUT:
    'Tiempo agotado. Causas probables: la conexion directa de Supabase es solo IPv6 y su red no la alcanza (use la cadena "Session pooler"), o el proyecto esta pausado por inactividad (reanudelo en el panel).',
  ECONNREFUSED: 'Conexion rechazada: el servidor no escucha en ese puerto.',
  '28P01':
    'Autenticacion fallida: revise la clave de la base en DATABASE_URL (codificada en la URL).',
  '3D000': 'La base indicada no existe.',
};
