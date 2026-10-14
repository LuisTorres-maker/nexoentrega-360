// Enumeraciones del caso y maquina de estados. Sin entrada ni salida (puro).

export const ROLES = ['SOLICITANTE', 'COORDINADOR', 'BODEGA', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];

export const ZONAS = ['NORTE', 'CENTRO', 'SUR', 'ORIENTE', 'OCCIDENTE'] as const;
export type Zona = (typeof ZONAS)[number];

export const PRIORIDADES = ['NORMAL', 'ALTA'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ESTADOS = [
  'BORRADOR',
  'ENVIADA',
  'RESERVADA',
  'DESPACHADA',
  'ENTREGADA',
  'CANCELADA',
] as const;
export type Estado = (typeof ESTADOS)[number];

export type Accion = 'ENVIAR' | 'RESERVAR' | 'CANCELAR' | 'DESPACHAR' | 'ENTREGAR';

export interface Transicion {
  accion: Accion;
  desde: readonly Estado[];
  hacia: Estado;
  rol: Role;
}

/** Unicas transiciones permitidas. Cualquier otra responde 409 y no cambia nada (RF04). */
export const TRANSICIONES: Record<Accion, Transicion> = {
  ENVIAR: { accion: 'ENVIAR', desde: ['BORRADOR'], hacia: 'ENVIADA', rol: 'SOLICITANTE' },
  RESERVAR: { accion: 'RESERVAR', desde: ['ENVIADA'], hacia: 'RESERVADA', rol: 'COORDINADOR' },
  CANCELAR: {
    accion: 'CANCELAR',
    desde: ['ENVIADA', 'RESERVADA'],
    hacia: 'CANCELADA',
    rol: 'SOLICITANTE',
  },
  DESPACHAR: { accion: 'DESPACHAR', desde: ['RESERVADA'], hacia: 'DESPACHADA', rol: 'BODEGA' },
  ENTREGAR: { accion: 'ENTREGAR', desde: ['DESPACHADA'], hacia: 'ENTREGADA', rol: 'COORDINADOR' },
};

export function puedeTransitar(accion: Accion, desde: Estado): boolean {
  return TRANSICIONES[accion].desde.includes(desde);
}
