import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cerrarSesion, iniciarSesion, leerSesion, type Sesion } from './api';

interface Contexto {
  sesion: Sesion | null;
  entrar(correo: string, clave: string): Promise<void>;
  salir(): Promise<void>;
}

const Ctx = createContext<Contexto | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion());

  useEffect(() => {
    const alVencer = () => setSesion(null);
    window.addEventListener('nexo:sesion-vencida', alVencer);
    return () => window.removeEventListener('nexo:sesion-vencida', alVencer);
  }, []);

  const entrar = useCallback(async (correo: string, clave: string) => {
    setSesion(await iniciarSesion(correo, clave));
  }, []);
  const salir = useCallback(async () => {
    await cerrarSesion();
    setSesion(null);
  }, []);

  const valor = useMemo(() => ({ sesion, entrar, salir }), [sesion, entrar, salir]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSesion fuera de ProveedorSesion');
  return c;
}
