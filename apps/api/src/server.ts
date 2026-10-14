// Punto de entrada: lee variables de entorno, abre el pool y levanta la API.
import { config } from 'dotenv';
import pg from 'pg';
import { join } from 'node:path';
import { proveedorDesdeEntorno } from './ai/ai';
import { createApp } from './app';

config({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('FALLO: DATABASE_URL no esta definida.');
  process.exit(1);
}
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
const pool = new pg.Pool({ connectionString: url, ssl, max: 10 });
const raiz = join(__dirname, '..', '..', '..');
const app = createApp({
  pool,
  sessionHours: Number(process.env.SESSION_HOURS ?? 8),
  aiProvider: proveedorDesdeEntorno(raiz),
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 5000),
});
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API escuchando en el puerto ${port}`);
});
