-- 002_security.sql: seguridad por filas (RLS) y revocaciones. Idempotente.
-- Las tablas del esquema public de Supabase quedan expuestas a su API REST con la clave anon
-- (que es publica por diseno). Este archivo activa RLS en todas las tablas SIN crear politicas y
-- revoca permisos a anon y authenticated: con esa clave no se puede leer ni escribir nada.
-- La API de NexoEntrega entra como el usuario postgres, que no se ve afectado.
-- En Postgres local los roles anon y authenticated no existen y las revocaciones se omiten.
-- Requisito: RNF01.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
      'organizations', 'users', 'sessions', 'skus', 'inventory', 'requests',
      'request_lines', 'audit_events', 'idempotency_keys', 'ai_summary_attempts',
      'schema_migrations'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;

  -- La funcion del disparador no debe ser invocable por roles publicos (el disparador funciona igual).
  REVOKE EXECUTE ON FUNCTION public.audit_readonly() FROM PUBLIC;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE EXECUTE ON FUNCTION public.audit_readonly() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public.audit_readonly() FROM authenticated;
  END IF;
END $$;

INSERT INTO schema_migrations (name) VALUES ('002_security.sql') ON CONFLICT DO NOTHING;
