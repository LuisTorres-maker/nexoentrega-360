// Genera los archivos SQL de datos semilla a partir de los hechos oficiales del caso.
//   node scripts/seed-gen.mjs            escribe seeds/000_reset_demo.sql, 001_base.sql y 002_load.sql
//   node scripts/seed-gen.mjs --check    falla (codigo 1) si algun archivo difiere de lo generado
//
// Fuente: docs/anexos/fixture-scenarios.json (hechos del caso) + las adiciones del equipo
// declaradas abajo (A-003, A-004, KIT-INACTIVO y org-a-solicitante2; ver docs/data-model.md).
// La clave de las cuentas sale de DEMO_PASSWORD y es ficticia (solo demostracion).
// Los hashes usan una sal derivada del correo para que la generacion sea reproducible.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SOLO_COMPROBAR = process.argv.includes('--check');

if (existsSync(join(RAIZ, '.env'))) process.loadEnvFile(join(RAIZ, '.env'));
const CLAVE = process.env.DEMO_PASSWORD;
if (!CLAVE || CLAVE.length < 8) {
  console.error('FALLO: defina DEMO_PASSWORD (ficticia, al menos 8 caracteres) en .env.');
  process.exit(1);
}

const hechos = JSON.parse(
  readFileSync(join(RAIZ, 'docs', 'anexos', 'fixture-scenarios.json'), 'utf8').replace(
    /^\ufeff/,
    '',
  ),
);

const q = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

// ---- hechos y adiciones ------------------------------------------------------------------
const ORGS = hechos.organizations.map((id) => ({
  id,
  name: `Organizacion comunitaria ${id.slice(-1)}`,
}));
const SKUS = [
  { code: 'KIT-ALIMENTO', name: 'Kit de alimentos', active: true },
  { code: 'KIT-HIGIENE', name: 'Kit de higiene', active: true },
  { code: 'KIT-AGUA', name: 'Kit de agua', active: true },
  // Adicion del equipo: SKU inactivo para probar el 422 de Q8. Sin inventario.
  { code: 'KIT-INACTIVO', name: 'Kit retirado (inactivo)', active: false },
];
const ROLES = {
  SOLICITANTE: 'Solicitante',
  COORDINADOR: 'Coordinador',
  BODEGA: 'Bodega',
  AUDITOR: 'Auditor',
};
const CUENTAS = hechos.accounts.map((a) => ({
  email: a.login,
  org: a.organizationId,
  role: a.role,
  name: `${ROLES[a.role]} ${a.organizationId}`,
}));
// Adicion del equipo: segundo solicitante de ORG-A (prueba Q6).
CUENTAS.splice(1, 0, {
  email: 'org-a-solicitante2@example.test',
  org: 'ORG-A',
  role: 'SOLICITANTE',
  name: 'Solicitante 2 ORG-A',
});

const MINUTO = 60_000;
const BASE_CREACION = Date.parse('2030-01-10T10:00:00Z');
const SOLICITUDES = hechos.requests.map((r, i) => ({
  code: r.requestId,
  org: r.organizationId,
  owner: r.ownerLogin,
  status: r.status,
  zone: r.zona,
  priority: r.prioridad,
  required: r.fechaRequerida,
  notes: r.observaciones,
  lines: r.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
  created: new Date(BASE_CREACION + i * 5 * MINUTO).toISOString(),
}));
// Adiciones del equipo (no tocan KIT-ALIMENTO de ORG-A: los oraculos no cambian).
SOLICITUDES.push(
  {
    code: 'A-003',
    org: 'ORG-A',
    owner: 'org-a-solicitante@example.test',
    status: 'BORRADOR',
    zone: 'NORTE',
    priority: 'NORMAL',
    required: '2030-01-15T14:00:00Z',
    notes: 'Borrador de ejemplo.',
    lines: [{ sku: 'KIT-AGUA', quantity: 2 }],
    created: new Date(BASE_CREACION + 15 * MINUTO).toISOString(),
  },
  {
    code: 'A-004',
    org: 'ORG-A',
    owner: 'org-a-solicitante@example.test',
    status: 'CANCELADA',
    zone: 'CENTRO',
    priority: 'NORMAL',
    required: '2030-01-13T14:00:00Z',
    notes: 'Solicitud cancelada de ejemplo.',
    lines: [{ sku: 'KIT-HIGIENE', quantity: 3 }],
    created: new Date(BASE_CREACION + 20 * MINUTO).toISOString(),
  },
);

// ---- hash determinista ---------------------------------------------------------------------
const ALFABETO = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function salDe(email) {
  const h = createHash('sha256').update(`nexo-seed:${email}`).digest();
  let s = '';
  for (let i = 0; i < 21; i++) s += ALFABETO[h[i] % 64];
  s += ALFABETO[(h[21] % 4) * 16]; // el ultimo caracter solo codifica 2 bits utiles
  return `$2a$10$${s}`;
}

// ---- generacion del SQL --------------------------------------------------------------------
function sqlBase() {
  const L = [];
  L.push('-- Datos semilla base de NexoEntrega 360 (idempotente: ON CONFLICT DO NOTHING).');
  L.push(
    '-- GENERADO por scripts/seed-gen.mjs desde docs/anexos/fixture-scenarios.json. No editar a mano.',
  );
  L.push(
    '-- Las cuentas usan una clave FICTICIA de demostracion (variable DEMO_PASSWORD) guardada como hash bcrypt.',
  );
  L.push(
    '-- Adiciones del equipo: org-a-solicitante2, A-003 (BORRADOR), A-004 (CANCELADA) y KIT-INACTIVO.',
  );
  L.push('-- Requiere aplicar antes 001_init.sql y 002_security.sql.');
  L.push('');
  L.push('INSERT INTO organizations (id, name) VALUES');
  L.push(ORGS.map((o) => `  (${q(o.id)}, ${q(o.name)})`).join(',\n'));
  L.push('ON CONFLICT (id) DO NOTHING;');
  L.push('');
  L.push('INSERT INTO skus (code, name, active) VALUES');
  L.push(
    SKUS.map((s) => `  (${q(s.code)}, ${q(s.name)}, ${s.active ? 'TRUE' : 'FALSE'})`).join(',\n'),
  );
  L.push('ON CONFLICT (code) DO NOTHING;');
  L.push('');
  L.push('INSERT INTO users (org_id, email, display_name, password_hash, role) VALUES');
  L.push(
    CUENTAS.map(
      (c) =>
        `  (${q(c.org)}, ${q(c.email)}, ${q(c.name)}, ${q(bcrypt.hashSync(CLAVE, salDe(c.email)))}, ${q(c.role)})`,
    ).join(',\n'),
  );
  L.push('ON CONFLICT (email) DO NOTHING;');
  L.push('');
  L.push('INSERT INTO inventory (org_id, sku_id, on_hand, reserved)');
  L.push('SELECT v.org_id, s.id, v.on_hand, v.reserved FROM (VALUES');
  L.push(
    hechos.stock
      .map((s) => `  (${q(s.organizationId)}, ${q(s.sku)}, ${s.onHand}, ${s.reserved})`)
      .join(',\n'),
  );
  L.push(') AS v (org_id, sku, on_hand, reserved) JOIN skus s ON s.code = v.sku');
  L.push('ON CONFLICT (org_id, sku_id) DO NOTHING;');
  L.push('');
  L.push(
    'INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, notes, status, created_at, updated_at)',
  );
  L.push(
    'SELECT v.code, v.org_id, u.id, v.zone, v.priority, v.required_date::timestamptz, v.notes, v.status, v.created_at::timestamptz, v.created_at::timestamptz FROM (VALUES',
  );
  L.push(
    SOLICITUDES.map(
      (r) =>
        `  (${q(r.code)}, ${q(r.org)}, ${q(r.owner)}, ${q(r.zone)}, ${q(r.priority)}, ${q(r.required)}, ${q(r.notes)}, ${q(r.status)}, ${q(r.created)})`,
    ).join(',\n'),
  );
  L.push(
    ') AS v (code, org_id, owner, zone, priority, required_date, notes, status, created_at) JOIN users u ON u.email = v.owner',
  );
  L.push('ON CONFLICT (code) DO NOTHING;');
  L.push('');
  L.push('INSERT INTO request_lines (request_id, sku_id, quantity)');
  L.push('SELECT r.id, s.id, v.quantity FROM (VALUES');
  L.push(
    SOLICITUDES.flatMap((r) =>
      r.lines.map((l) => `  (${q(r.code)}, ${q(l.sku)}, ${l.quantity})`),
    ).join(',\n'),
  );
  L.push(
    ') AS v (code, sku, quantity) JOIN requests r ON r.code = v.code JOIN skus s ON s.code = v.sku',
  );
  L.push('ON CONFLICT (request_id, sku_id) DO NOTHING;');
  L.push('');
  L.push(
    "INSERT INTO schema_migrations (name) VALUES ('seed_001_base.sql') ON CONFLICT DO NOTHING;",
  );
  return L.join('\n') + '\n';
}

function sqlReset(base) {
  return [
    '-- ADVERTENCIA: ESTE ARCHIVO BORRA TODOS LOS DATOS DE LA APLICACION Y VUELVE A SEMBRAR EL ESTADO INICIAL.',
    '-- Solo para ejecucion MANUAL (SQL Editor de Supabase o base local). Nunca lo ejecutan scripts ni el CI.',
    '-- GENERADO por scripts/seed-gen.mjs. No borra schema_migrations ni la estructura.',
    '',
    'TRUNCATE audit_events, idempotency_keys, ai_summary_attempts, request_lines, requests,',
    '  inventory, sessions, users, skus, organizations RESTART IDENTITY CASCADE;',
    'ALTER SEQUENCE request_code_seq RESTART WITH 1;',
    '',
    base,
  ].join('\n');
}

function sqlCarga() {
  // Estados sin efecto pendiente en inventario: no incluye RESERVADA, asi el inventario del
  // seed base sigue siendo consistente (reservado = suma de lineas de solicitudes RESERVADA).
  const L = [];
  L.push('-- Seed de CARGA (RNF03): 2.000 solicitudes aparte del seed base. Idempotente.');
  L.push(
    '-- GENERADO por scripts/seed-gen.mjs. Solo para pruebas de lectura (listados y tablero).',
  );
  L.push('-- No ejecutar el flujo de reservas sobre estas solicitudes: son datos de volumen.');
  L.push('-- Codigos L-000001 a L-002000: 1.500 en ORG-A y 500 en ORG-B. Requiere 001_base.sql.');
  L.push('');
  L.push(
    'INSERT INTO requests (code, org_id, requester_id, zone, priority, required_date, notes, status, created_at, updated_at)',
  );
  L.push(`SELECT 'L-' || lpad(g::text, 6, '0'),`);
  L.push(`       CASE WHEN g % 4 = 0 THEN 'ORG-B' ELSE 'ORG-A' END,`);
  L.push(
    `       (SELECT id FROM users WHERE email = CASE WHEN g % 4 = 0 THEN 'org-b-solicitante@example.test' ELSE 'org-a-solicitante@example.test' END),`,
  );
  L.push(`       (ARRAY['NORTE','CENTRO','SUR','ORIENTE','OCCIDENTE'])[1 + g % 5],`);
  L.push(`       (ARRAY['NORMAL','ALTA'])[1 + g % 2],`);
  L.push(`       timestamptz '2030-02-01T14:00:00Z' + make_interval(days => g % 30),`);
  L.push(`       'carga ' || g,`);
  L.push(`       (ARRAY['BORRADOR','ENVIADA','DESPACHADA','ENTREGADA','CANCELADA'])[1 + g % 5],`);
  L.push(`       timestamptz '2030-01-05T00:00:00Z' + make_interval(mins => g),`);
  L.push(`       timestamptz '2030-01-05T00:00:00Z' + make_interval(mins => g)`);
  L.push('FROM generate_series(1, 2000) AS g');
  L.push('ON CONFLICT (code) DO NOTHING;');
  L.push('');
  L.push('INSERT INTO request_lines (request_id, sku_id, quantity)');
  L.push(
    `SELECT r.id, (SELECT id FROM skus WHERE code = (ARRAY['KIT-ALIMENTO','KIT-HIGIENE','KIT-AGUA'])[1 + (substr(r.code, 3)::int) % 3]), 1 + (substr(r.code, 3)::int) % 5`,
  );
  L.push(`FROM requests r WHERE r.code LIKE 'L-%'`);
  L.push('ON CONFLICT (request_id, sku_id) DO NOTHING;');
  L.push('');
  L.push(
    "INSERT INTO schema_migrations (name) VALUES ('seed_002_load.sql') ON CONFLICT DO NOTHING;",
  );
  return L.join('\n') + '\n';
}

const base = sqlBase();
const archivos = {
  'seeds/001_base.sql': base,
  'seeds/000_reset_demo.sql': sqlReset(base),
  'seeds/002_load.sql': sqlCarga(),
};

let difieren = 0;
for (const [ruta, contenido] of Object.entries(archivos)) {
  const destino = join(RAIZ, ruta);
  if (SOLO_COMPROBAR) {
    const actual = existsSync(destino) ? readFileSync(destino, 'utf8') : null;
    if (actual !== contenido) {
      console.error(`DIFIERE: ${ruta} (ejecute: npm run seed:gen)`);
      difieren++;
    }
  } else {
    writeFileSync(destino, contenido, 'utf8');
    console.log(`Escrito: ${ruta}`);
  }
}
if (SOLO_COMPROBAR) {
  if (difieren) process.exit(1);
  console.log('Seeds al dia: coinciden con lo generado.');
}
