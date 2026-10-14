-- Seed de CARGA (RNF03): 2.000 solicitudes aparte del seed base. Idempotente.
-- GENERADO por scripts/seed-gen.mjs. Solo para pruebas de lectura (listados y tablero).
-- No ejecutar el flujo de reservas sobre estas solicitudes: son datos de volumen.
-- Codigos L-000001 a L-002000: 1.500 en ORG-A y 500 en ORG-B. Requiere 001_base.sql.

INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, notes, status, created_at, updated_at)
SELECT 'L-' || lpad(g::text, 6, '0'),
       CASE WHEN g % 4 = 0 THEN 'ORG-B' ELSE 'ORG-A' END,
       (SELECT id FROM users WHERE email = CASE WHEN g % 4 = 0 THEN 'org-b-solicitante@example.test' ELSE 'org-a-solicitante@example.test' END),
       (ARRAY['NORTE','CENTRO','SUR','ORIENTE','OCCIDENTE'])[1 + g % 5],
       (ARRAY['NORMAL','ALTA'])[1 + g % 2],
       timestamptz '2030-02-01T14:00:00Z' + make_interval(days => g % 30),
       'carga ' || g,
       (ARRAY['BORRADOR','ENVIADA','DESPACHADA','ENTREGADA','CANCELADA'])[1 + g % 5],
       timestamptz '2030-01-05T00:00:00Z' + make_interval(mins => g),
       timestamptz '2030-01-05T00:00:00Z' + make_interval(mins => g)
FROM generate_series(1, 2000) AS g
ON CONFLICT (code) DO NOTHING;

INSERT INTO request_lines (request_id, sku_id, quantity)
SELECT r.id, (SELECT id FROM skus WHERE code = (ARRAY['KIT-ALIMENTO','KIT-HIGIENE','KIT-AGUA'])[1 + (substr(r.code, 3)::int) % 3]), 1 + (substr(r.code, 3)::int) % 5
FROM requests r WHERE r.code LIKE 'L-%'
ON CONFLICT (request_id, sku_id) DO NOTHING;

INSERT INTO schema_migrations (name) VALUES ('seed_002_load.sql') ON CONFLICT DO NOTHING;
