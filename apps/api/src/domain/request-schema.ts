// Validadores de solicitud (RF03). Puros: sin base de datos ni reloj propio.
import { z } from 'zod';
import { PRIORIDADES, ZONAS } from './enums';

export const lineaSchema = z.strictObject({
  sku: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
});

export const solicitudSchema = z.strictObject({
  zone: z.enum(ZONAS),
  priority: z.enum(PRIORIDADES),
  requiredDate: z.iso.datetime(),
  notes: z.string().max(500).optional(),
  lines: z.array(lineaSchema).min(1).max(10),
});

export type SolicitudInput = z.infer<typeof solicitudSchema>;

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

/** Primer error de un resultado de zod, con la ruta del campo en forma lines.0.quantity. */
export function primerErrorDe(error: z.ZodError): ErrorCampo {
  const issue = error.issues[0];
  if (!issue) return { campo: '', mensaje: 'Datos invalidos.' };
  const campo = issue.path.map(String).join('.');
  if (issue.code === 'unrecognized_keys') {
    const extra = (issue as { keys?: string[] }).keys?.[0] ?? '';
    return {
      campo: [campo, extra].filter(Boolean).join('.'),
      mensaje: 'Campo no permitido en la solicitud.',
    };
  }
  return { campo, mensaje: mensajeDe(campo, issue.message) };
}

function mensajeDe(campo: string, original: string): string {
  if (/quantity$/.test(campo)) return 'La cantidad debe ser un entero entre 1 y 500.';
  if (campo === 'zone') return 'La zona debe ser NORTE, CENTRO, SUR, ORIENTE u OCCIDENTE.';
  if (campo === 'priority') return 'La prioridad debe ser NORMAL o ALTA.';
  if (campo === 'requiredDate') return 'La fecha requerida debe ser ISO 8601 en UTC.';
  if (campo === 'notes') return 'Las observaciones admiten hasta 500 caracteres.';
  if (campo === 'lines') return 'La solicitud debe tener de 1 a 10 lineas.';
  return original;
}

/** SKU repetidos entre lineas (RF03). Devuelve el codigo repetido o null. */
export function skuRepetido(lines: { sku: string }[]): string | null {
  const vistos = new Set<string>();
  for (const l of lines) {
    if (vistos.has(l.sku)) return l.sku;
    vistos.add(l.sku);
  }
  return null;
}

/** La fecha requerida no puede ser anterior al momento de envio (RF03). */
export function fechaValidaParaEnvio(isoUtc: string, ahora: Date): boolean {
  return new Date(isoUtc).getTime() >= ahora.getTime();
}
