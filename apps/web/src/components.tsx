// Componentes compartidos. Todo texto de la API y de la IA se muestra como texto (React lo escapa).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { mensajeParaUsuario, type Estado } from './api';

export function Alerta({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="alerta" role="alert" id={id}>
      {children}
    </p>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="aviso" role="status">
      {children}
    </p>
  );
}

export function EtiquetaEstado({ estado }: { estado: Estado }) {
  return <span className={`estado estado-${estado.toLowerCase()}`}>{estado}</span>;
}

/** Ejecuta una accion, desactiva el boton mientras corre y muestra el error comprensible. */
export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const ejecutar = useCallback(async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
    setOcupado(true);
    setError(null);
    try {
      return await f();
    } catch (e) {
      if (montado.current) setError(mensajeParaUsuario(e));
      return undefined;
    } finally {
      if (montado.current) setOcupado(false);
    }
  }, []);
  return { ocupado, error, ejecutar, limpiar: () => setError(null) };
}

export function useCarga<T>(cargar: () => Promise<T>, dependencias: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    cargar()
      .then((d) => {
        if (vigente) {
          setDatos(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeParaUsuario(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [...dependencias, version]);
  return { datos, error, cargando, recargar: () => setVersion((v) => v + 1) };
}
