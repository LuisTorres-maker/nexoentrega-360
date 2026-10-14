// RNF02 (infraestructura de pruebas). Sin AC propio: las SPECS se escriben en R1.
// Oraculo escrito a mano: solo localhost, 127.0.0.1 y db-test pasan; Supabase nunca.
import { describe, expect, it } from 'vitest';
import { assertSafeTestDb } from '../../apps/api/src/db/safe-test-db';

const LOCAL = 'postgresql://nexo:test@localhost:54329/nexo_test';
const SUPABASE_DIRECTA = 'postgresql://postgres:x@db.abc.supabase.co:5432/postgres';
const SUPABASE_POOLER =
  'postgresql://postgres.abc:x@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

describe('assertSafeTestDb', () => {
  it('acepta la URL local por defecto', () => {
    expect(() => assertSafeTestDb(LOCAL, false)).not.toThrow();
  });

  it('acepta 127.0.0.1 y el servicio db-test', () => {
    expect(() =>
      assertSafeTestDb('postgresql://nexo:test@127.0.0.1:5432/nexo_test', false),
    ).not.toThrow();
    expect(() =>
      assertSafeTestDb('postgres://nexo:test@db-test:5432/nexo_test', false),
    ).not.toThrow();
  });

  it('rechaza una URL vacia o ausente', () => {
    expect(() => assertSafeTestDb('', false)).toThrow(/vacio/);
    expect(() => assertSafeTestDb(undefined, false)).toThrow(/vacio/);
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
    const remota = 'postgresql://nexo:test@bd.ejemplo.org:5432/nexo_test';
    expect(() => assertSafeTestDb(remota, false)).toThrow(/local/);
    expect(() => assertSafeTestDb(remota, true)).not.toThrow();
  });

  it('el mensaje de error no filtra la clave de la URL', () => {
    const conClave = 'postgresql://postgres:ClaveMuyPrivada@db.abc.supabase.co:5432/postgres';
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
