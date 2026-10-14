// Prueba de carga de RNF03: listados y tablero (sin IA), 20 usuarios virtuales durante 60 s
// despues de 5 s de calentamiento, sobre 2.000 solicitudes sembradas (seeds/002_load.sql).
//   npm run load
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    calentamiento: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5s',
      exec: 'escenario',
      tags: { fase: 'calentamiento' },
    },
    medicion: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      startTime: '5s',
      exec: 'escenario',
      tags: { fase: 'medicion' },
    },
  },
  thresholds: {
    'http_req_duration{fase:medicion}': ['p(95)<700'],
    'http_req_failed{fase:medicion}': ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

export function setup() {
  const r = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'org-a-coordinador@example.test', password: __ENV.DEMO_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (r.status !== 200) throw new Error(`login fallo: ${r.status}`);
  return { token: r.json('token') };
}

export function escenario(data) {
  const h = { headers: { Authorization: `Bearer ${data.token}` } };
  const pagina = 1 + Math.floor(Math.random() * 20);
  const lista = http.get(`${BASE}/requests?page=${pagina}&pageSize=50&status=ENVIADA`, h);
  const tablero = http.get(`${BASE}/dashboard`, h);
  check(lista, { 'lista 200': (r) => r.status === 200 });
  check(tablero, { 'tablero 200': (r) => r.status === 200 });
}
