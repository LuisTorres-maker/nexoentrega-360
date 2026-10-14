-- 001_init.sql: esquema de NexoEntrega 360.
-- Idempotente: se puede ejecutar mas de una vez sin error ni datos duplicados.
-- Se aplica igual en Supabase (pegado en el SQL Editor) y en Postgres local (npm run migrate).
-- Requisitos: RF03, RF05, RF06, RF07, RF09, RNF01, RNF02 (restricciones en la base, no solo en el codigo).

CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organizaciones: ORG-A y ORG-B (el id es el identificador del caso).
CREATE TABLE IF NOT EXISTS organizations (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Cuentas. El correo se guarda en minusculas (comparacion sin distinguir mayusculas, SPEC-001 S3).
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations (id),
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('SOLICITANTE', 'COORDINADOR', 'BODEGA', 'AUDITOR'))
);

-- Sesiones opacas: solo se guarda el hash SHA-256 del token (RF01).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at)
);

-- Catalogo de productos (kits). code es el identificador publico (KIT-AGUA).
CREATE TABLE IF NOT EXISTS skus (
  id     SERIAL PRIMARY KEY,
  code   TEXT NOT NULL UNIQUE,
  name   TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Inventario por organizacion y SKU. Disponible = on_hand - reserved y nunca es negativo (RF05).
CREATE TABLE IF NOT EXISTS inventory (
  org_id   TEXT NOT NULL REFERENCES organizations (id),
  sku_id   INT  NOT NULL REFERENCES skus (id),
  on_hand  INT  NOT NULL CHECK (on_hand >= 0),
  reserved INT  NOT NULL CHECK (reserved >= 0),
  PRIMARY KEY (org_id, sku_id),
  CHECK (reserved <= on_hand)
);

-- Solicitudes. code lo genera el sistema (SOL-000001); el seed escribe A-001, A-002, B-001.
CREATE SEQUENCE IF NOT EXISTS request_code_seq;

CREATE TABLE IF NOT EXISTS requests (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE
                DEFAULT ('SOL-' || lpad(nextval('request_code_seq')::text, 6, '0')),
  org_id        TEXT NOT NULL REFERENCES organizations (id),
  requester_id  INT  NOT NULL REFERENCES users (id),
  zone          TEXT NOT NULL CHECK (zone IN ('NORTE', 'CENTRO', 'SUR', 'ORIENTE', 'OCCIDENTE')),
  priority      TEXT NOT NULL CHECK (priority IN ('NORMAL', 'ALTA')),
  required_date TIMESTAMPTZ NOT NULL,
  notes         TEXT CHECK (char_length(notes) <= 500),
  status        TEXT NOT NULL CHECK (status IN
                  ('BORRADOR', 'ENVIADA', 'RESERVADA', 'DESPACHADA', 'ENTREGADA', 'CANCELADA')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requests_org_status    ON requests (org_id, status);
CREATE INDEX IF NOT EXISTS requests_org_priority  ON requests (org_id, priority);
CREATE INDEX IF NOT EXISTS requests_org_zone      ON requests (org_id, zone);
CREATE INDEX IF NOT EXISTS requests_org_created   ON requests (org_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS requests_requester     ON requests (org_id, requester_id, created_at DESC);

-- Lineas: de 1 a 10 por solicitud (regla de la aplicacion), cantidad de 1 a 500 y SKU sin repetir (base).
CREATE TABLE IF NOT EXISTS request_lines (
  id         SERIAL PRIMARY KEY,
  request_id INT NOT NULL REFERENCES requests (id) ON DELETE CASCADE,
  sku_id     INT NOT NULL REFERENCES skus (id),
  quantity   INT NOT NULL CHECK (quantity BETWEEN 1 AND 500),
  UNIQUE (request_id, sku_id)
);

-- Auditoria: solo escritura. Un disparador impide UPDATE y DELETE (RF09).
CREATE TABLE IF NOT EXISTS audit_events (
  id             BIGSERIAL PRIMARY KEY,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id        INT  NOT NULL REFERENCES users (id),
  org_id         TEXT NOT NULL REFERENCES organizations (id),
  resource_type  TEXT NOT NULL CHECK (resource_type IN ('REQUEST', 'AI_SUMMARY')),
  resource_id    TEXT NOT NULL,
  action         TEXT NOT NULL CHECK (action IN
                   ('ENVIAR', 'RESERVAR', 'CANCELAR', 'DESPACHAR', 'ENTREGAR', 'APROBAR_RESUMEN')),
  from_status    TEXT,
  to_status      TEXT,
  correlation_id TEXT NOT NULL,
  CHECK ((action = 'APROBAR_RESUMEN') = (resource_type = 'AI_SUMMARY'))
);

CREATE INDEX IF NOT EXISTS audit_org_time ON audit_events (org_id, occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION audit_readonly() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events es de solo escritura (no se permite %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_no_change') THEN
    CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON audit_events
      FOR EACH ROW EXECUTE FUNCTION audit_readonly();
  END IF;
END $$;

-- Llaves de idempotencia (RF07). Solo se guardan respuestas exitosas (Q5).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  org_id        TEXT NOT NULL REFERENCES organizations (id),
  user_id       INT  NOT NULL REFERENCES users (id),
  operation     TEXT NOT NULL,
  key           TEXT NOT NULL CHECK (char_length(key) BETWEEN 1 AND 128),
  request_hash  TEXT NOT NULL,
  status_code   INT  NOT NULL,
  response_body JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id, operation, key)
);

CREATE INDEX IF NOT EXISTS idempotency_created ON idempotency_keys (created_at);

-- Intentos de resumen de IA (RF10 a RF12, Q4). Aprobar guarda quien y cuando.
CREATE TABLE IF NOT EXISTS ai_summary_attempts (
  id             SERIAL PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organizations (id),
  user_id        INT  NOT NULL REFERENCES users (id),
  request_ids    TEXT[] NOT NULL CHECK (cardinality(request_ids) BETWEEN 1 AND 20),
  source         TEXT NOT NULL CHECK (source IN ('PROVEEDOR', 'ALTERNATIVO')),
  outcome        TEXT NOT NULL,
  notice         TEXT,
  summary        JSONB,
  correlation_id TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by    INT REFERENCES users (id),
  approved_at    TIMESTAMPTZ,
  CHECK ((approved_by IS NULL) = (approved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS ai_attempts_org ON ai_summary_attempts (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS inventory_sku ON inventory (sku_id);

INSERT INTO schema_migrations (name) VALUES ('001_init.sql') ON CONFLICT DO NOTHING;
