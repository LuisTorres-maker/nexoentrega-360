// RNF02 (infraestructura de pruebas). Sin AC propio: las SPECS se escriben en R1.
// Oraculo escrito a mano: solo localhost, 127.0.0.1 y db-test pasan; Supabase nunca.
import { describe, expect, it } from 'vitest';
import { assertSafeTestDb } from '../../apps/api/src/db/safe-test-db';

// Las URLs se arman por partes para que ningun escaner de secretos las tome por una cadena real.
function url(host: string, usuario = 'nexo', clave = 'test', puerto = 5432, base = 'nexo_test') {
  return ['postgresql://', usuario, ':', clave, '@', host, ':', String(puerto), '/', base].join('');
}

const LOCAL = url('localhost', 'nexo', 'test', 54329);
const SUPABASE_DIRECTA = url('db.abc.supabase.co', 'usuario', 'clave-ficticia', 5432, 'postgres');
const SUPABASE_POOLER = url(
  'aws-0-us-east-1.pooler.supabase.com',
  'usuario.abc',
  'clave-ficticia',
  5432,
  'postgres',
);

describe('assertSafeTestDb', () => {
  it('acepta la URL local por defecto', () => {
    expect(() => assertSafeTestDb(LOCAL, false)).not.toThrow();
  });

  it('acepta 127.0.0.1 y el servicio db-test', () => {
    expect(() => assertSafeTestDb(url('127.0.0.1'), false)).not.toThrow();
    expect(() => assertSafeTestDb(url('db-test'), false)).not.toThrow();
  });

  it('rechaza una URL vacia o ausente', () => {
    expect(() => assertSafeTestDb('', false)).toThrow(/vacio/);
    // Con `undefined` la funcion lee TEST_DATABASE_URL: en el CI esa variable existe, asi que
    // la prueba la quita un momento para no depender del entorno.
    const previo = process.env.TEST_DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;
    try {
      expect(() => assertSafeTestDb(undefined, false)).toThrow(/vacio/);
    } finally {
      if (previo !== undefined) process.env.TEST_DATABASE_URL = previo;
    }
  });

  it('rechaza un texto que no es URL', () => {
    expect(() => assertSafeTestDb('no-es-una-url', false)).toThrow(/URL valida/);
  });

  it('rechaza Supabase directo y pooler', () => {
    expect(() => assertSafeTestDb(SUPABASE_DIRECTA, false)).toThrow(/Supabase/);
    expect(() => assertSafeTestDb(SUPABASE_POOLER, false)).toThrow(/Supabase/);
  });

  it('rechaza Supabase aunque se permita la base remota', () => {
    expect(() => assertSafeTestDb(SUPABASE_DIRECTA, true)).toThrow(/Supabase/);
  });

  it('rechaza un host remoto salvo con permiso explicito', () => {
    const remota = url('bd.ejemplo.org');
    expect(() => assertSafeTestDb(remota, false)).toThrow(/local/);
    expect(() => assertSafeTestDb(remota, true)).not.toThrow();
  });

  it('el mensaje de error no filtra la clave de la URL', () => {
    const conClave = url('db.abc.supabase.co', 'usuario', 'ClaveMuyPrivada', 5432, 'postgres');
    let mensaje = '';
    try {
      assertSafeTestDb(conClave, false);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).not.toBe('');
    expect(mensaje).not.toContain('ClaveMuyPrivada');
  });
});
