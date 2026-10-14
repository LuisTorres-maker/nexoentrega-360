-- Datos semilla base de NexoEntrega 360 (idempotente: ON CONFLICT DO NOTHING).
-- GENERADO por scripts/seed-gen.mjs desde docs/anexos/fixture-scenarios.json. No editar a mano.
-- Las cuentas usan una clave FICTICIA de demostracion (variable DEMO_PASSWORD) guardada como hash bcrypt.
-- Adiciones del equipo: org-a-solicitante2, A-003 (BORRADOR), A-004 (CANCELADA) y KIT-INACTIVO.
-- Requiere aplicar antes 001_init.sql y 002_security.sql.

INSERT INTO organizations (id, name) VALUES
  ('ORG-A', 'Organizacion comunitaria A'),
  ('ORG-B', 'Organizacion comunitaria B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO skus (code, name, active) VALUES
  ('KIT-ALIMENTO', 'Kit de alimentos', TRUE),
  ('KIT-HIGIENE', 'Kit de higiene', TRUE),
  ('KIT-AGUA', 'Kit de agua', TRUE),
  ('KIT-INACTIVO', 'Kit retirado (inactivo)', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (org_id, email, display_name, password_hash, role) VALUES
  ('ORG-A', 'org-a-solicitante@example.test', 'Solicitante ORG-A', '$2a$10$jDQy3Vyjscn5nTvKIcdHJ.4DBGAaQX0UNEIPAIxKaXImc7Vyl.r0a', 'SOLICITANTE'),
  ('ORG-A', 'org-a-solicitante2@example.test', 'Solicitante 2 ORG-A', '$2a$10$XfYmvjUZKVjRMqvwERz6f.bO4iZCdfpQrXgP/36JFl.HkbI/gV68i', 'SOLICITANTE'),
  ('ORG-A', 'org-a-coordinador@example.test', 'Coordinador ORG-A', '$2a$10$FQi1t6lUV.N9H4bK.9MGtus9f2InhEc3/iqg6XYw.Apf/yIX8IaPW', 'COORDINADOR'),
  ('ORG-A', 'org-a-bodega@example.test', 'Bodega ORG-A', '$2a$10$w3skOun2trd54kRwhC.8EefvBuMyidVmt3pawMSJJsmYwJ6ua7fva', 'BODEGA'),
  ('ORG-A', 'org-a-auditor@example.test', 'Auditor ORG-A', '$2a$10$totOwqu3iuQ4IvwCOEou2eDEWlVXBo1B2Z/LzUTBF9g0ZWWMqSqum', 'AUDITOR'),
  ('ORG-B', 'org-b-solicitante@example.test', 'Solicitante ORG-B', '$2a$10$9pMND.80G9KY/Y4.S70Juuq1uUwM.lMXmBRQmtZMJdJodo5Gu5Umq', 'SOLICITANTE'),
  ('ORG-B', 'org-b-coordinador@example.test', 'Coordinador ORG-B', '$2a$10$PhrN772CxgFLnn5laBSx3OdF2sJjkU0fRQeIR2G87K3Lo8fzLTXDu', 'COORDINADOR'),
  ('ORG-B', 'org-b-bodega@example.test', 'Bodega ORG-B', '$2a$10$3CEzRUQ8voD7ayslnwJk2elsLyq6BluOrvtCRMnPrivYXmOCIE1y6', 'BODEGA'),
  ('ORG-B', 'org-b-auditor@example.test', 'Auditor ORG-B', '$2a$10$dI3O4bXBJGq4BLhzK95neeHV9ikFs6FNmffW8gk4yd4UNF2apo05K', 'AUDITOR')
ON CONFLICT (email) DO NOTHING;

INSERT INTO inventory (org_id, sku_id, on_hand, reserved)
SELECT v.org_id, s.id, v.on_hand, v.reserved FROM (VALUES
  ('ORG-A', 'KIT-ALIMENTO', 10, 0),
  ('ORG-A', 'KIT-HIGIENE', 8, 0),
  ('ORG-A', 'KIT-AGUA', 20, 0),
  ('ORG-B', 'KIT-ALIMENTO', 4, 0),
  ('ORG-B', 'KIT-HIGIENE', 5, 0),
  ('ORG-B', 'KIT-AGUA', 6, 0)
) AS v (org_id, sku, on_hand, reserved) JOIN skus s ON s.code = v.sku
ON CONFLICT (org_id, sku_id) DO NOTHING;

INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, notes, status, created_at, updated_at)
SELECT v.code, v.org_id, u.id, v.zone, v.priority, v.required_date::timestamptz, v.notes, v.status, v.created_at::timestamptz, v.created_at::timestamptz FROM (VALUES
  ('A-001', 'ORG-A', 'org-a-solicitante@example.test', 'NORTE', 'ALTA', '2030-01-11T14:00:00Z', 'Entrega comunitaria programada.', 'ENVIADA', '2030-01-10T10:00:00.000Z'),
  ('A-002', 'ORG-A', 'org-a-solicitante@example.test', 'SUR', 'NORMAL', '2030-01-12T14:00:00Z', 'Solicitud pendiente.', 'ENVIADA', '2030-01-10T10:05:00.000Z'),
  ('B-001', 'ORG-B', 'org-b-solicitante@example.test', 'CENTRO', 'ALTA', '2030-01-11T15:00:00Z', 'Dato exclusivo de ORG-B.', 'ENVIADA', '2030-01-10T10:10:00.000Z'),
  ('A-003', 'ORG-A', 'org-a-solicitante@example.test', 'NORTE', 'NORMAL', '2030-01-15T14:00:00Z', 'Borrador de ejemplo.', 'BORRADOR', '2030-01-10T10:15:00.000Z'),
  ('A-004', 'ORG-A', 'org-a-solicitante@example.test', 'CENTRO', 'NORMAL', '2030-01-13T14:00:00Z', 'Solicitud cancelada de ejemplo.', 'CANCELADA', '2030-01-10T10:20:00.000Z')
) AS v (code, org_id, owner, zone, priority, required_date, notes, status, created_at) JOIN users u ON u.email = v.owner
ON CONFLICT (code) DO NOTHING;

INSERT INTO request_lines (request_id, sku_id, quantity)
SELECT r.id, s.id, v.quantity FROM (VALUES
  ('A-001', 'KIT-ALIMENTO', 7),
  ('A-002', 'KIT-ALIMENTO', 7),
  ('B-001', 'KIT-HIGIENE', 2),
  ('A-003', 'KIT-AGUA', 2),
  ('A-004', 'KIT-HIGIENE', 3)
) AS v (code, sku, quantity) JOIN requests r ON r.code = v.code JOIN skus s ON s.code = v.sku
ON CONFLICT (request_id, sku_id) DO NOTHING;

INSERT INTO schema_migrations (name) VALUES ('seed_001_base.sql') ON CONFLICT DO NOTHING;
