// RNF05 AC-RNF05-01 AC-RNF05-02 AC-RNF05-03 | RF12 AC-RF12-01 | recorrido completo por interfaz
// (RF03 a RF07). Contra la API en Docker Compose; la base se reinicia en global-setup.
import { expect, test, type Browser, type Page } from '@playwright/test';

const CLAVE = process.env.DEMO_PASSWORD ?? 'Demo-Nexo-2030';

async function entrar(page: Page, correo: string): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

async function sesion(browser: Browser, correo: string): Promise<Page> {
  const ctx = await browser.newContext({ locale: 'es-CO', timezoneId: 'America/Bogota' });
  const page = await ctx.newPage();
  await entrar(page, correo);
  return page;
}

async function crearYEnviar(page: Page, sku: string, cantidad: string): Promise<string> {
  await page.getByRole('link', { name: 'Nueva solicitud' }).first().click();
  await page.getByLabel('Fecha requerida (hora de Bogotá)').fill('2030-01-20T14:00');
  await page.getByLabel('Producto 1').selectOption(sku);
  await page.getByLabel('Cantidad 1').fill(cantidad);
  await page.getByRole('button', { name: 'Guardar y enviar' }).click();
  // Las solicitudes sembradas llevan fecha de 2030 y salen primero: se toma la primera creada aqui (SOL-).
  const tarjeta = page.locator('li[data-codigo^="SOL-"]').first();
  await expect(tarjeta.getByText('ENVIADA')).toBeVisible();
  const codigo = await tarjeta.getAttribute('data-codigo');
  expect(codigo).toMatch(/^SOL-\d{6}$/);
  return codigo as string;
}

test('AC-RF04-11 por interfaz: solicitante crea y envía, coordinador reserva, bodega despacha, coordinador entrega', async ({
  browser,
}) => {
  const sol = await sesion(browser, 'org-a-solicitante@example.test');
  const codigo = await crearYEnviar(sol, 'KIT-ALIMENTO', '2');

  const coord = await sesion(browser, 'org-a-coordinador@example.test');
  const filaCoord = coord.locator(`li[data-codigo="${codigo}"]`);
  await expect(filaCoord).toBeVisible();
  await filaCoord.getByRole('button', { name: 'Reservar' }).click();
  await expect(filaCoord.getByText('RESERVADA')).toBeVisible();

  const bodega = await sesion(browser, 'org-a-bodega@example.test');
  const filaBodega = bodega.locator(`li[data-codigo="${codigo}"]`);
  await filaBodega.getByRole('button', { name: 'Despachar' }).click();
  await expect(filaBodega).toHaveCount(0);

  await coord.reload();
  const filaCoord2 = coord.locator(`li[data-codigo="${codigo}"]`);
  await expect(filaCoord2.getByText('DESPACHADA')).toBeVisible();
  await filaCoord2.getByRole('button', { name: 'Marcar entregada' }).click();
  await expect(filaCoord2.getByText('ENTREGADA')).toBeVisible();

  // La auditoria registra los cuatro pasos.
  const aud = await sesion(browser, 'org-a-auditor@example.test');
  await aud.getByRole('link', { name: 'Auditoría' }).first().click();
  for (const accion of ['ENVIAR', 'RESERVAR', 'DESPACHAR', 'ENTREGAR']) {
    await expect(aud.getByText(accion, { exact: true }).first()).toBeVisible();
  }
});

test('AC-RF06-01 por interfaz: cancelar una RESERVADA libera el stock', async ({ browser }) => {
  const sol = await sesion(browser, 'org-a-solicitante@example.test');
  const codigo = await crearYEnviar(sol, 'KIT-AGUA', '3');
  const coord = await sesion(browser, 'org-a-coordinador@example.test');
  await coord
    .locator(`li[data-codigo="${codigo}"]`)
    .getByRole('button', { name: 'Reservar' })
    .click();
  await expect(coord.locator(`li[data-codigo="${codigo}"]`).getByText('RESERVADA')).toBeVisible();

  await coord.getByRole('link', { name: 'Tablero' }).click();
  const agua = coord.locator('li', { hasText: 'KIT-AGUA' });
  await expect(agua.getByText('Reservado: 3')).toBeVisible();

  await sol.reload();
  await sol
    .locator(`li[data-codigo="${codigo}"]`)
    .getByRole('button', { name: 'Cancelar solicitud' })
    .click();
  await expect(sol.locator(`li[data-codigo="${codigo}"]`).getByText('CANCELADA')).toBeVisible();

  await coord.reload();
  await expect(
    coord.locator('li', { hasText: 'KIT-AGUA' }).getByText('Reservado: 0'),
  ).toBeVisible();
});

test('AC-RF12-01 por interfaz: el resumen de IA aparece marcado, como texto y con botón Aprobar aparte', async ({
  browser,
}) => {
  const coord = await sesion(browser, 'org-a-coordinador@example.test');
  await coord.getByLabel('Incluir A-001 en el resumen').check();
  await coord.getByRole('button', { name: 'Generar resumen' }).click();
  await expect(coord.getByText('Generado con asistencia de IA')).toBeVisible();
  await expect(coord.getByText('Origen:')).toBeVisible();
  // Texto, no HTML: ningun <script> ni elemento inyectado dentro del borrador.
  await expect(coord.locator('article[aria-label="Borrador del resumen"] script')).toHaveCount(0);
  await coord.getByRole('button', { name: 'Aprobar' }).click();
  await expect(coord.getByText('Resumen aprobado')).toBeVisible();
});

test('AC-RNF05-03: error 422 asociado al campo con role alert, aria-describedby y aria-invalid', async ({
  browser,
}) => {
  const sol = await sesion(browser, 'org-a-solicitante@example.test');
  await sol.getByRole('link', { name: 'Nueva solicitud' }).first().click();
  await sol.getByLabel('Fecha requerida (hora de Bogotá)').fill('2030-01-20T14:00');
  await sol.getByLabel('Cantidad 1').fill('0');
  await sol.getByRole('button', { name: 'Guardar borrador' }).click();
  const alerta = sol.getByRole('alert');
  await expect(alerta).toContainText('cantidad');
  const idAlerta = await alerta.getAttribute('id');
  await expect(sol.getByLabel('Cantidad 1')).toHaveAttribute(
    'aria-describedby',
    idAlerta as string,
  );
  await expect(sol.getByLabel('Cantidad 1')).toHaveAttribute('aria-invalid', 'true');
});

for (const ancho of [390, 1366]) {
  test(`AC-RNF05-01: sin desbordamiento horizontal a ${ancho} px`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: ancho, height: 800 },
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
    });
    const page = await ctx.newPage();
    const medir = async (nombre: string) => {
      const r = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        ancho: window.innerWidth,
      }));
      expect(r.scroll, `${nombre} a ${ancho}px`).toBeLessThanOrEqual(r.ancho);
    };
    await page.goto('/entrar');
    await medir('inicio de sesión');
    await entrar(page, 'org-a-solicitante@example.test');
    await medir('mis solicitudes');
    await page.getByRole('link', { name: 'Nueva solicitud' }).first().click();
    await medir('nueva solicitud');
    await page.getByRole('link', { name: 'Tablero' }).click();
    await medir('tablero');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await entrar(page, 'org-a-coordinador@example.test');
    await medir('bandeja');
    await page.getByRole('link', { name: 'Auditoría' }).first().click();
    await medir('auditoría');
    await ctx.close();
  });
}

test('AC-RNF05-02: login y creación de solicitud operables con teclado', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'es-CO', timezoneId: 'America/Bogota' });
  const page = await ctx.newPage();
  await page.goto('/entrar');
  await page.getByLabel('Correo').focus();
  await page.keyboard.type('org-a-solicitante@example.test');
  await page.keyboard.press('Tab');
  await page.keyboard.type(CLAVE);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible();

  // Enlace "Nueva solicitud" del menu: se activa con Enter.
  await page.getByRole('link', { name: 'Nueva solicitud' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Nueva solicitud' })).toBeVisible();

  await page.getByLabel('Zona').focus();
  await page.keyboard.press('Tab'); // prioridad
  await expect(page.getByLabel('Prioridad')).toBeFocused();
  await page.keyboard.press('Tab'); // fecha
  await expect(page.getByLabel('Fecha requerida (hora de Bogotá)')).toBeFocused();
  await page.getByLabel('Fecha requerida (hora de Bogotá)').fill('2030-01-20T14:00');
  // El campo de fecha tiene varios segmentos con foco; se vuelve al flujo con Tab desde Observaciones.
  await page.getByLabel(/^Observaciones/).focus();
  await page.keyboard.press('Tab'); // producto 1
  await expect(page.getByLabel('Producto 1')).toBeFocused();
  await page.keyboard.press('Tab'); // cantidad 1
  await expect(page.getByLabel('Cantidad 1')).toBeFocused();
  await page.keyboard.press('Tab'); // agregar linea
  await page.keyboard.press('Tab'); // guardar borrador
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible();
  await expect(page.locator('li[data-codigo^="SOL-"]').first().getByText('BORRADOR')).toBeVisible();
  await ctx.close();
});
