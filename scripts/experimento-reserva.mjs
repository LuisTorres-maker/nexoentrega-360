// Experimento de la decision de ADR-0002 (bitacora IA-03): compara estrategias para reservar
// inventario cuando dos peticiones compiten por el mismo stock. Usa SOLO TEST_DATABASE_URL (local)
// y un esquema propio (exp_reserva) que crea y borra. No toca las tablas de la aplicacion.
//
//   npm run db:test:up
//   node scripts/experimento-reserva.mjs [repeticiones]     (por defecto 30)
//
// Escenario del caso: fisico 10; dos solicitudes de 7 unidades al mismo tiempo (A-001 y A-002).
// Resultado correcto: exactamente una gana, reservado final 7. Segundo escenario: 15 solicitudes
// de 1 unidad con fisico 10: exactamente 10 ganan y reservado final 10.
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const URL_LOCAL =
  process.env.TEST_DATABASE_URL || 'postgresql://nexo:test@localhost:54329/nexo_test';
const host = new URL(URL_LOCAL).hostname;
if (
  /supabase\.(co|com)/i.test(URL_LOCAL) ||
  !['localhost', '127.0.0.1', 'db-test'].includes(host)
) {
  console.error('ABORTADO: el experimento solo corre contra Postgres local de pruebas.');
  process.exit(1);
}
const REPETICIONES = Number(process.argv[2] ?? 30);
const pool = new pg.Pool({ connectionString: URL_LOCAL, max: 20 });
const S = 'exp_reserva';

async function preparar(fisico, cantidades) {
  await pool.query(`DROP SCHEMA IF EXISTS ${S} CASCADE`);
  await pool.query(`CREATE SCHEMA ${S}`);
  await pool.query(`CREATE TABLE ${S}.inv (
      id INT PRIMARY KEY, on_hand INT NOT NULL CHECK (on_hand >= 0),
      reserved INT NOT NULL CHECK (reserved >= 0), version INT NOT NULL DEFAULT 0,
      CHECK (reserved <= on_hand))`);
  await pool.query(
    `CREATE TABLE ${S}.req (id INT PRIMARY KEY, qty INT NOT NULL, status TEXT NOT NULL)`,
  );
  await pool.query(`INSERT INTO ${S}.inv (id, on_hand, reserved) VALUES (1, $1, 0)`, [fisico]);
  for (const [i, q] of cantidades.entries())
    await pool.query(`INSERT INTO ${S}.req VALUES ($1, $2, 'ENVIADA')`, [i + 1, q]);
}

// Estrategia A: bloqueo pesimista. FOR UPDATE sobre la solicitud + UPDATE condicional.
async function pesimista(reqId) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query(`SELECT qty, status FROM ${S}.req WHERE id = $1 FOR UPDATE`, [reqId]);
    if (r.rows[0].status !== 'ENVIADA') {
      await c.query('ROLLBACK');
      return 409;
    }
    const u = await c.query(
      `UPDATE ${S}.inv SET reserved = reserved + $1 WHERE id = 1 AND on_hand - reserved >= $1`,
      [r.rows[0].qty],
    );
    if (u.rowCount === 0) {
      await c.query('ROLLBACK');
      return 409;
    }
    await c.query(`UPDATE ${S}.req SET status = 'RESERVADA' WHERE id = $1`, [reqId]);
    await c.query('COMMIT');
    return 200;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    return `ERR:${e.code ?? e.message}`;
  } finally {
    c.release();
  }
}

// Estrategia B: bloqueo optimista con columna de version y reintentos.
async function optimista(reqId) {
  for (let intento = 0; intento < 10; intento++) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const inv = await c.query(`SELECT on_hand, reserved, version FROM ${S}.inv WHERE id = 1`);
      const r = await c.query(`SELECT qty FROM ${S}.req WHERE id = $1`, [reqId]);
      const { on_hand, reserved, version } = inv.rows[0];
      if (on_hand - reserved < r.rows[0].qty) {
        await c.query('ROLLBACK');
        return 409;
      }
      const u = await c.query(
        `UPDATE ${S}.inv SET reserved = reserved + $1, version = version + 1
          WHERE id = 1 AND version = $2`,
        [r.rows[0].qty, version],
      );
      if (u.rowCount === 0) {
        await c.query('ROLLBACK');
        continue; // alguien cambio la version: reintentar
      }
      await c.query(`UPDATE ${S}.req SET status = 'RESERVADA' WHERE id = $1`, [reqId]);
      await c.query('COMMIT');
      return 200;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      return `ERR:${e.code ?? e.message}`;
    } finally {
      c.release();
    }
  }
  return 'AGOTO_REINTENTOS';
}

// Estrategia C: cola en la aplicacion (un solo trabajador en proceso). Serializa todo.
let cola = Promise.resolve();
function enCola(reqId) {
  const tarea = cola.then(() => pesimista(reqId));
  cola = tarea.catch(() => {});
  return tarea;
}

// Control negativo: leer y luego escribir SIN bloqueo ni condicion. Debe fallar.
async function ingenua(reqId) {
  const c = await pool.connect();
  try {
    const inv = await c.query(`SELECT on_hand, reserved FROM ${S}.inv WHERE id = 1`);
    const r = await c.query(`SELECT qty FROM ${S}.req WHERE id = $1`, [reqId]);
    if (inv.rows[0].on_hand - inv.rows[0].reserved < r.rows[0].qty) return 409;
    await new Promise((res) => setTimeout(res, 5)); // ventana de carrera realista (red, logica)
    await c.query(`UPDATE ${S}.inv SET reserved = $1 WHERE id = 1`, [
      inv.rows[0].reserved + r.rows[0].qty,
    ]);
    await c.query(`UPDATE ${S}.req SET status = 'RESERVADA' WHERE id = $1`, [reqId]);
    return 200;
  } catch (e) {
    return `ERR:${e.code ?? e.message}`;
  } finally {
    c.release();
  }
}

const ESTRATEGIAS = [
  ['pesimista (FOR UPDATE + UPDATE condicional)', pesimista],
  ['optimista (version + reintentos)', optimista],
  ['cola en la aplicacion (un trabajador)', enCola],
  ['ingenua sin bloqueo (control negativo)', ingenua],
];
const ESCENARIOS = [
  { nombre: 'dos de 7 con fisico 10', fisico: 10, cantidades: [7, 7], ganan: 1, reservado: 7 },
  {
    nombre: 'quince de 1 con fisico 10',
    fisico: 10,
    cantidades: Array(15).fill(1),
    ganan: 10,
    reservado: 10,
  },
];

const filas = [];
try {
  for (const esc of ESCENARIOS) {
    for (const [nombre, fn] of ESTRATEGIAS) {
      let correctas = 0;
      let inconsistentes = 0;
      let errores = 0;
      const tiempos = [];
      for (let i = 0; i < REPETICIONES; i++) {
        await preparar(esc.fisico, esc.cantidades);
        const t0 = performance.now();
        const res = await Promise.all(esc.cantidades.map((_, k) => fn(k + 1)));
        tiempos.push(performance.now() - t0);
        const inv = (await pool.query(`SELECT reserved FROM ${S}.inv WHERE id = 1`)).rows[0];
        const exitos = res.filter((r) => r === 200).length;
        const raros = res.filter((r) => r !== 200 && r !== 409).length;
        errores += raros;
        if (exitos === esc.ganan && inv.reserved === esc.reservado && raros === 0) correctas++;
        else inconsistentes++;
      }
      tiempos.sort((a, b) => a - b);
      const p50 = tiempos[Math.floor(tiempos.length / 2)];
      filas.push({
        escenario: esc.nombre,
        estrategia: nombre,
        correctas: `${correctas}/${REPETICIONES}`,
        inconsistentes,
        errores,
        'mediana ms': Number(p50.toFixed(1)),
      });
    }
  }
} finally {
  await pool.query(`DROP SCHEMA IF EXISTS ${S} CASCADE`).catch(() => {});
  await pool.end();
}
console.log(
  `Repeticiones por celda: ${REPETICIONES}. Servidor: ${URL_LOCAL.split('@')[1] ?? 'local'}`,
);
console.table(filas);
