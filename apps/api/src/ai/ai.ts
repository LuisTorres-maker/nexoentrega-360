// Asistente de IA (ADR-0004): interfaz de proveedor, validador estricto, servicio con timeout y
// resumen determinista alternativo. La IA nunca escribe datos: su salida es texto NO confiable.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export interface ItemEntradaIA {
  requestId: string;
  zona: string;
  prioridad: 'NORMAL' | 'ALTA';
  fechaRequerida: string;
  estado: 'ENVIADA';
  observaciones: string | null;
}

export interface AiProvider {
  readonly name: string;
  /** Devuelve texto JSON (rawOutput) o un objeto. Debe respetar la senal de aborto. */
  summarize(items: ItemEntradaIA[], signal: AbortSignal): Promise<unknown>;
}

// ---- validador ----------------------------------------------------------------------------------

const CAMPOS_EVIDENCIA = ['zona', 'prioridad', 'fechaRequerida', 'observaciones'] as const;

const recomendacionSchema = z.strictObject({
  requestId: z.string().min(1),
  reason: z.string().min(1).max(240),
  evidenceFields: z.array(z.enum(CAMPOS_EVIDENCIA)).min(1).max(3),
});
const salidaSchema = z.strictObject({
  summary: z.string().min(1).max(600),
  recommendations: z.array(recomendacionSchema).max(5),
});
export type SalidaIA = z.infer<typeof salidaSchema>;

export type ResultadoValidacion =
  | { ok: true; datos: SalidaIA }
  | {
      ok: false;
      motivo: 'JSON_INVALIDO' | 'ESQUEMA_INVALIDO' | 'ID_AJENO' | 'ID_DUPLICADO' | 'CAMPO_REPETIDO';
    };

/** Valida la salida cruda: JSON, esquema cerrado en los dos niveles y reglas en codigo. */
export function validarSalida(raw: unknown, permitidos: ReadonlySet<string>): ResultadoValidacion {
  let objeto: unknown = raw;
  if (typeof raw === 'string') {
    try {
      objeto = JSON.parse(raw);
    } catch {
      return { ok: false, motivo: 'JSON_INVALIDO' };
    }
  }
  const r = salidaSchema.safeParse(objeto);
  if (!r.success) return { ok: false, motivo: 'ESQUEMA_INVALIDO' };
  const vistos = new Set<string>();
  for (const rec of r.data.recommendations) {
    if (!permitidos.has(rec.requestId)) return { ok: false, motivo: 'ID_AJENO' };
    if (vistos.has(rec.requestId)) return { ok: false, motivo: 'ID_DUPLICADO' };
    vistos.add(rec.requestId);
    if (new Set(rec.evidenceFields).size !== rec.evidenceFields.length) {
      return { ok: false, motivo: 'CAMPO_REPETIDO' };
    }
  }
  return { ok: true, datos: r.data };
}

// ---- servicio -----------------------------------------------------------------------------------

export interface ResumenGenerado {
  origen: 'PROVEEDOR' | 'ALTERNATIVO';
  generadoConIA: boolean;
  aviso: string | null;
  motivo: string;
  resultado: SalidaIA;
}

const TIMEOUT_POR_DEFECTO_MS = 5000;

export function resumenAlternativo(items: ItemEntradaIA[], motivo: string): ResumenGenerado {
  const orden = [...items]
    .sort(
      (a, b) =>
        (a.prioridad === b.prioridad ? 0 : a.prioridad === 'ALTA' ? -1 : 1) ||
        a.fechaRequerida.localeCompare(b.fechaRequerida) ||
        a.requestId.localeCompare(b.requestId),
    )
    .slice(0, 5);
  const altas = items.filter((i) => i.prioridad === 'ALTA').length;
  return {
    origen: 'ALTERNATIVO',
    generadoConIA: false,
    aviso: `No se pudo usar la IA (${motivo}). Se muestra un resumen automatico simple.`,
    motivo,
    resultado: {
      summary: `${items.length} solicitudes ENVIADA, ${altas} con prioridad ALTA.`,
      recommendations: orden.map((i) => ({
        requestId: i.requestId,
        reason: `Prioridad ${i.prioridad} y fecha requerida ${i.fechaRequerida}.`,
        evidenceFields: ['prioridad', 'fechaRequerida'] as ('prioridad' | 'fechaRequerida')[],
      })),
    },
  };
}

export async function generarResumen(
  proveedor: AiProvider | null,
  items: ItemEntradaIA[],
  timeoutMs: number = TIMEOUT_POR_DEFECTO_MS,
): Promise<ResumenGenerado> {
  if (!proveedor) return resumenAlternativo(items, 'IA_APAGADA');
  const permitidos = new Set(items.map((i) => i.requestId));
  const ctrl = new AbortController();
  let temporizador: NodeJS.Timeout | undefined;
  try {
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => {
        ctrl.abort();
        rechazar(new Error('TIMEOUT'));
      }, timeoutMs);
    });
    const raw = await Promise.race([proveedor.summarize(items, ctrl.signal), limite]);
    const v = validarSalida(raw, permitidos);
    if (v.ok) {
      return {
        origen: 'PROVEEDOR',
        generadoConIA: true,
        aviso: null,
        motivo: 'OK',
        resultado: v.datos,
      };
    }
    return resumenAlternativo(items, v.motivo);
  } catch (e) {
    const motivo = (e as Error).message === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR_PROVEEDOR';
    return resumenAlternativo(items, motivo);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

// ---- proveedores --------------------------------------------------------------------------------

interface FixtureIA {
  id: string;
  transport: 'success' | 'timeout' | 'provider-error';
  rawOutput?: string;
  simulatedLatencyMs?: number;
}

function esperar(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const t = setTimeout(resolver, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      rechazar(new Error('ABORTADO'));
    });
  });
}

/** Lee los fixtures oficiales por id (tests/fixtures/ai-provider-fixtures.json). */
export class FixtureProvider implements AiProvider {
  readonly name: string;
  private readonly fixture: FixtureIA;
  constructor(fixtureId: string, rutaJson: string) {
    this.name = `fixture:${fixtureId}`;
    const datos = JSON.parse(readFileSync(rutaJson, 'utf8').replace(/^\ufeff/, '')) as {
      fixtures: FixtureIA[];
    };
    const f = datos.fixtures.find((x) => x.id === fixtureId);
    if (!f) throw new Error(`Fixture desconocido: ${fixtureId}`);
    this.fixture = f;
  }
  async summarize(_items: ItemEntradaIA[], signal: AbortSignal): Promise<unknown> {
    if (this.fixture.transport === 'provider-error') throw new Error('PROVEEDOR_CAIDO');
    if (this.fixture.transport === 'timeout') {
      await esperar(this.fixture.simulatedLatencyMs ?? 5001, signal);
    }
    return this.fixture.rawOutput;
  }
}

/** Reproduce una respuesta real capturada (evidence/ai-real/respuesta.json). No es una invocacion en vivo. */
export class ReplayProvider implements AiProvider {
  readonly name = 'replay';
  constructor(private readonly ruta: string) {}
  async summarize(): Promise<unknown> {
    return readFileSync(this.ruta, 'utf8');
  }
}

/** Para pruebas: devuelve una salida fija y registra lo que recibio. */
export class SpyProvider implements AiProvider {
  readonly name = 'spy';
  readonly llamadas: ItemEntradaIA[][] = [];
  constructor(private readonly salida: unknown) {}
  async summarize(items: ItemEntradaIA[]): Promise<unknown> {
    this.llamadas.push(items.map((i) => ({ ...i })));
    return this.salida;
  }
}

export function proveedorDesdeEntorno(
  raiz: string,
  env: NodeJS.ProcessEnv = process.env,
): AiProvider | null {
  const modo = (env.AI_PROVIDER ?? 'replay').toLowerCase();
  if (modo === 'off') return null;
  if (modo === 'fixture') {
    return new FixtureProvider(
      env.AI_FIXTURE_ID ?? 'AI-VALID',
      join(raiz, 'tests', 'fixtures', 'ai-provider-fixtures.json'),
    );
  }
  // 'replay' (por defecto). 'http' no esta implementado: se trata como replay y, si falta la
  // respuesta capturada, el resumen alternativo cubre el fallo.
  return new ReplayProvider(join(raiz, 'evidence', 'ai-real', 'respuesta.json'));
}
