// Guardia de las pruebas: nunca se vacian tablas en una base que no sea local.
// Las pruebas hacen TRUNCATE; por eso la URL de pruebas debe ser Postgres local
// (o el servicio db-test de Docker) y jamas Supabase.

const HOSTS_LOCALES = ['localhost', '127.0.0.1', 'db-test'];

export function assertSafeTestDb(
  url: string | undefined = process.env.TEST_DATABASE_URL,
  permitirRemota: boolean = process.env.ALLOW_REMOTE_TEST_DB === '1',
): void {
  // Los mensajes no incluyen la URL: puede contener la clave.
  if (!url || url.trim() === '') {
    throw new Error('TEST_DATABASE_URL esta vacio: defina la base local de pruebas.');
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('TEST_DATABASE_URL no es una URL valida.');
  }
  if (/supabase\.(co|com)/i.test(url)) {
    throw new Error('Las pruebas no pueden correr contra Supabase: use Postgres local.');
  }
  if (!HOSTS_LOCALES.includes(host) && !permitirRemota) {
    throw new Error('Las pruebas solo corren contra Postgres local de pruebas.');
  }
}
