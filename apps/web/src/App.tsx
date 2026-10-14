import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Rol } from './api';
import {
  Auditoria,
  Bandeja,
  Bodega,
  FormularioSolicitud,
  Login,
  MisSolicitudes,
  PaginaTablero,
} from './pages';
import { ProveedorSesion, useSesion } from './sesion';

const ENLACES: Record<Rol, { a: string; texto: string }[]> = {
  SOLICITANTE: [
    { a: '/solicitudes', texto: 'Mis solicitudes' },
    { a: '/solicitudes/nueva', texto: 'Nueva solicitud' },
    { a: '/tablero', texto: 'Tablero' },
  ],
  COORDINADOR: [
    { a: '/bandeja', texto: 'Bandeja' },
    { a: '/auditoria', texto: 'Auditoría' },
    { a: '/tablero', texto: 'Tablero' },
  ],
  BODEGA: [
    { a: '/bodega', texto: 'Bodega' },
    { a: '/tablero', texto: 'Tablero' },
  ],
  AUDITOR: [
    { a: '/auditoria', texto: 'Auditoría' },
    { a: '/tablero', texto: 'Tablero' },
  ],
};

const INICIO: Record<Rol, string> = {
  SOLICITANTE: '/solicitudes',
  COORDINADOR: '/bandeja',
  BODEGA: '/bodega',
  AUDITOR: '/auditoria',
};

function Cascara({ children }: { children: ReactNode }) {
  const { sesion, salir } = useSesion();
  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="cabecera">
        <Link to="/" className="marca">
          NexoEntrega 360
        </Link>
        {sesion && (
          <nav aria-label="Principal">
            <ul>
              {ENLACES[sesion.rol].map((e) => (
                <li key={e.a}>
                  <NavLink to={e.a} end>
                    {e.texto}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {sesion && (
          <div className="usuario">
            <span>
              {sesion.nombre} · {sesion.rol} · {sesion.orgId}
            </span>
            <button type="button" className="secundario" onClick={() => void salir()}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <div id="contenido" className="contenedor">
        {children}
      </div>
    </>
  );
}

function Protegida({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { sesion } = useSesion();
  if (!sesion) return <Navigate to="/entrar" replace />;
  // La pantalla se oculta por comodidad; la autorizacion real la hace el servidor en cada operacion.
  if (!roles.includes(sesion.rol)) return <Navigate to={INICIO[sesion.rol]} replace />;
  return <>{children}</>;
}

function Inicio() {
  const { sesion } = useSesion();
  return <Navigate to={sesion ? INICIO[sesion.rol] : '/entrar'} replace />;
}

const TODOS: Rol[] = ['SOLICITANTE', 'COORDINADOR', 'BODEGA', 'AUDITOR'];

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Cascara>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/entrar" element={<Login />} />
            <Route
              path="/solicitudes"
              element={
                <Protegida roles={['SOLICITANTE']}>
                  <MisSolicitudes />
                </Protegida>
              }
            />
            <Route
              path="/solicitudes/nueva"
              element={
                <Protegida roles={['SOLICITANTE']}>
                  <FormularioSolicitud />
                </Protegida>
              }
            />
            <Route
              path="/solicitudes/:code/editar"
              element={
                <Protegida roles={['SOLICITANTE']}>
                  <FormularioSolicitud />
                </Protegida>
              }
            />
            <Route
              path="/bandeja"
              element={
                <Protegida roles={['COORDINADOR']}>
                  <Bandeja />
                </Protegida>
              }
            />
            <Route
              path="/bodega"
              element={
                <Protegida roles={['BODEGA']}>
                  <Bodega />
                </Protegida>
              }
            />
            <Route
              path="/auditoria"
              element={
                <Protegida roles={['COORDINADOR', 'AUDITOR']}>
                  <Auditoria />
                </Protegida>
              }
            />
            <Route
              path="/tablero"
              element={
                <Protegida roles={TODOS}>
                  <PaginaTablero />
                </Protegida>
              }
            />
            <Route path="*" element={<Inicio />} />
          </Routes>
        </Cascara>
      </ProveedorSesion>
    </BrowserRouter>
  );
}
