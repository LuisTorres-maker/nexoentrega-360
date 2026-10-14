// Pantallas por rol. Los botones se desactivan mientras envian (evita clics dobles) y los errores
// se asocian al campo con aria-describedby y role="alert".
import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ErrorApi,
  llamar,
  mensajeParaUsuario,
  type Detalle,
  type EventoAuditoria,
  type Pagina,
  type Resumen,
  type ResumenIA,
  type Tablero,
} from './api';
import { Alerta, Aviso, EtiquetaEstado, useAccion, useCarga } from './components';
import { aInputLocal, desdeInputLocal, fechaBogota } from './format';
import { useSesion } from './sesion';

// ---- inicio de sesion ---------------------------------------------------------------------------

export function Login() {
  const { entrar } = useSesion();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const { ocupado, error, ejecutar } = useAccion();
  const idError = useId();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const ok = await ejecutar(async () => {
      await entrar(correo.trim(), clave);
      return true;
    });
    if (ok) navegar('/');
  }

  return (
    <main className="tarjeta estrecha">
      <h1>Iniciar sesión</h1>
      <form onSubmit={enviar} noValidate>
        <label htmlFor="correo">Correo</label>
        <input
          id="correo"
          type="email"
          autoComplete="username"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          aria-describedby={error ? idError : undefined}
          required
        />
        <label htmlFor="clave">Contraseña</label>
        <input
          id="clave"
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          aria-describedby={error ? idError : undefined}
          required
        />
        {error && <Alerta id={idError}>{error}</Alerta>}
        <button type="submit" disabled={ocupado}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

// ---- tablero ------------------------------------------------------------------------------------

export function PaginaTablero() {
  const { datos, error, cargando } = useCarga(() => llamar<Tablero>('/dashboard'), []);
  return (
    <main>
      <h1>Tablero</h1>
      {cargando && <p>Cargando…</p>}
      {error && <Alerta>{error}</Alerta>}
      {datos && (
        <>
          <h2>Solicitudes por estado</h2>
          <ul className="rejilla" aria-label="Solicitudes por estado">
            {Object.entries(datos.byStatus).map(([estado, n]) => (
              <li key={estado} className="tarjeta">
                <span className="num">{n}</span>
                <span>{estado}</span>
              </li>
            ))}
          </ul>
          {datos.inventory && <TablaInventario items={datos.inventory} />}
        </>
      )}
    </main>
  );
}

function TablaInventario({ items }: { items: NonNullable<Tablero['inventory']> }) {
  return (
    <section aria-labelledby="titulo-inventario">
      <h2 id="titulo-inventario">Inventario</h2>
      <ul className="rejilla">
        {items.map((i) => (
          <li key={i.sku} className="tarjeta inventario-item">
            <strong>{i.name}</strong>
            <span className="sku">{i.sku}</span>
            <span className="inv-linea">
              Físico: <b>{i.onHand}</b>
            </span>
            <span className="inv-linea">
              Reservado: <b>{i.reserved}</b>
            </span>
            <span className="inv-linea inv-disponible">
              Disponible: <b>{i.available}</b>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- solicitante: mis solicitudes ---------------------------------------------------------------

export function MisSolicitudes() {
  const lista = useCarga(
    () => llamar<Pagina<Resumen>>('/requests', { consulta: { pageSize: 50 } }),
    [],
  );
  const { ocupado, error, ejecutar } = useAccion();

  async function accion(code: string, ruta: 'submit' | 'cancel') {
    const r = await ejecutar(() =>
      llamar<Detalle>(`/requests/${code}/${ruta}`, { metodo: 'POST', cuerpo: {} }),
    );
    if (r) lista.recargar();
  }

  return (
    <main>
      <h1>Mis solicitudes</h1>
      <p>
        <Link className="boton" to="/solicitudes/nueva">
          Nueva solicitud
        </Link>
      </p>
      {lista.cargando && <p>Cargando…</p>}
      {lista.error && <Alerta>{lista.error}</Alerta>}
      {error && <Alerta>{error}</Alerta>}
      {lista.datos && lista.datos.items.length === 0 && (
        <Aviso>Todavía no tiene solicitudes.</Aviso>
      )}
      <ul className="lista">
        {lista.datos?.items.map((s) => (
          <li key={s.code} className="tarjeta" data-codigo={s.code}>
            <div className="fila">
              <strong>{s.code}</strong>
              <EtiquetaEstado estado={s.status} />
            </div>
            <p>
              {s.zone} · prioridad {s.priority} · requerida {fechaBogota(s.requiredDate)}
            </p>
            <div className="acciones">
              {s.status === 'BORRADOR' && (
                <>
                  <Link className="boton secundario" to={`/solicitudes/${s.code}/editar`}>
                    Editar
                  </Link>
                  <button type="button" disabled={ocupado} onClick={() => accion(s.code, 'submit')}>
                    Enviar
                  </button>
                </>
              )}
              {(s.status === 'ENVIADA' || s.status === 'RESERVADA') && (
                <button
                  type="button"
                  className="peligro"
                  disabled={ocupado}
                  onClick={() => accion(s.code, 'cancel')}
                >
                  Cancelar solicitud
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

// ---- solicitante: crear y editar ----------------------------------------------------------------

const SKUS = ['KIT-ALIMENTO', 'KIT-HIGIENE', 'KIT-AGUA'];
const ZONAS = ['NORTE', 'CENTRO', 'SUR', 'ORIENTE', 'OCCIDENTE'];

interface Linea {
  sku: string;
  quantity: string;
}

export function FormularioSolicitud() {
  const { code } = useParams();
  const editar = Boolean(code);
  const navegar = useNavigate();
  const [zona, setZona] = useState('NORTE');
  const [prioridad, setPrioridad] = useState('NORMAL');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([{ sku: SKUS[0]!, quantity: '1' }]);
  const [errorCampo, setErrorCampo] = useState<{ campo: string; mensaje: string } | null>(null);
  const { ocupado, error, ejecutar, limpiar } = useAccion();
  const idError = useId();

  const cargaInicial = useCarga(async () => {
    if (!code) return null;
    const d = await llamar<Detalle>(`/requests/${code}`);
    setZona(d.zone);
    setPrioridad(d.priority);
    setFecha(aInputLocal(d.requiredDate));
    setNotas(d.notes ?? '');
    setLineas(d.lines.map((l) => ({ sku: l.sku, quantity: String(l.quantity) })));
    return d;
  }, [code]);

  const sobreCampo = (campo: string) => (errorCampo?.campo === campo ? idError : undefined);

  async function guardar(enviar: boolean) {
    setErrorCampo(null);
    limpiar();
    if (!fecha) {
      setErrorCampo({ campo: 'requiredDate', mensaje: 'Indique la fecha requerida.' });
      return;
    }
    const cuerpo = {
      zone: zona,
      priority: prioridad,
      requiredDate: desdeInputLocal(fecha),
      ...(notas.trim() ? { notes: notas.trim() } : {}),
      lines: lineas.map((l) => ({ sku: l.sku, quantity: Number(l.quantity) })),
    };
    try {
      let detalle: Detalle;
      if (editar) {
        detalle = await llamar<Detalle>(`/requests/${code}`, { metodo: 'PATCH', cuerpo });
      } else {
        detalle = await llamar<Detalle>('/requests', { metodo: 'POST', cuerpo });
      }
      if (enviar) await llamar(`/requests/${detalle.code}/submit`, { metodo: 'POST', cuerpo: {} });
      navegar('/solicitudes');
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 422 && e.campo) {
        setErrorCampo({ campo: e.campo, mensaje: e.message });
      } else {
        throw e;
      }
    }
  }

  async function alEnviar(e: FormEvent, enviar: boolean) {
    e.preventDefault();
    await ejecutar(() => guardar(enviar));
  }

  function cambiarLinea(i: number, cambio: Partial<Linea>) {
    setLineas((ls) => ls.map((l, k) => (k === i ? { ...l, ...cambio } : l)));
  }

  const mensajeCampo = useMemo(() => errorCampo?.mensaje ?? null, [errorCampo]);

  return (
    <main className="tarjeta">
      <h1>{editar ? `Editar ${code}` : 'Nueva solicitud'}</h1>
      {cargaInicial.error && <Alerta>{cargaInicial.error}</Alerta>}
      <form onSubmit={(e) => alEnviar(e, false)} noValidate>
        <label htmlFor="zona">Zona</label>
        <select
          id="zona"
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          aria-describedby={sobreCampo('zone')}
        >
          {ZONAS.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>

        <label htmlFor="prioridad">Prioridad</label>
        <select
          id="prioridad"
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value)}
          aria-describedby={sobreCampo('priority')}
        >
          <option>NORMAL</option>
          <option>ALTA</option>
        </select>

        <label htmlFor="fecha">Fecha requerida (hora de Bogotá)</label>
        <input
          id="fecha"
          type="datetime-local"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          aria-describedby={sobreCampo('requiredDate')}
          aria-invalid={errorCampo?.campo === 'requiredDate'}
        />

        <label htmlFor="notas">Observaciones (opcional, hasta 500 caracteres)</label>
        <textarea
          id="notas"
          value={notas}
          maxLength={600}
          onChange={(e) => setNotas(e.target.value)}
          aria-describedby={sobreCampo('notes')}
          aria-invalid={errorCampo?.campo === 'notes'}
        />

        <fieldset>
          <legend>Productos (de 1 a 10 líneas)</legend>
          {lineas.map((l, i) => (
            <div className="fila-linea" key={i}>
              <div>
                <label htmlFor={`sku-${i}`}>Producto {i + 1}</label>
                <select
                  id={`sku-${i}`}
                  value={l.sku}
                  onChange={(e) => cambiarLinea(i, { sku: e.target.value })}
                  aria-describedby={sobreCampo(`lines.${i}.sku`)}
                >
                  {SKUS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`cantidad-${i}`}>Cantidad {i + 1}</label>
                <input
                  id={`cantidad-${i}`}
                  type="number"
                  inputMode="numeric"
                  value={l.quantity}
                  onChange={(e) => cambiarLinea(i, { quantity: e.target.value })}
                  aria-describedby={sobreCampo(`lines.${i}.quantity`)}
                  aria-invalid={errorCampo?.campo === `lines.${i}.quantity`}
                />
              </div>
              {lineas.length > 1 && (
                <button
                  type="button"
                  className="secundario"
                  onClick={() => setLineas((ls) => ls.filter((_, k) => k !== i))}
                >
                  Quitar línea {i + 1}
                </button>
              )}
            </div>
          ))}
          {lineas.length < 10 && (
            <button
              type="button"
              className="secundario"
              onClick={() => setLineas((ls) => [...ls, { sku: SKUS[0]!, quantity: '1' }])}
            >
              Agregar línea
            </button>
          )}
        </fieldset>

        {(errorCampo || error) && <Alerta id={idError}>{mensajeCampo ?? error}</Alerta>}

        <div className="acciones">
          <button type="submit" disabled={ocupado}>
            Guardar borrador
          </button>
          <button type="button" disabled={ocupado} onClick={(e) => alEnviar(e, true)}>
            Guardar y enviar
          </button>
        </div>
      </form>
    </main>
  );
}

// ---- coordinador: bandeja e IA ------------------------------------------------------------------

export function Bandeja() {
  const [estado, setEstado] = useState('');
  const [prioridad, setPrioridad] = useState('');
  const [zona, setZona] = useState('');
  const lista = useCarga(
    () =>
      llamar<Pagina<Resumen>>('/requests', {
        consulta: { pageSize: 100, status: estado, priority: prioridad, zone: zona },
      }),
    [estado, prioridad, zona],
  );
  const { ocupado, error, ejecutar } = useAccion();
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [resumen, setResumen] = useState<ResumenIA | null>(null);
  const [aprobado, setAprobado] = useState(false);

  async function reservar(code: string) {
    const r = await ejecutar(() =>
      llamar<Detalle>(`/requests/${code}/reserve`, {
        metodo: 'POST',
        cuerpo: {},
        llave: crypto.randomUUID(),
      }),
    );
    if (r) lista.recargar();
  }
  async function entregar(code: string) {
    const r = await ejecutar(() =>
      llamar<Detalle>(`/requests/${code}/deliver`, { metodo: 'POST', cuerpo: {} }),
    );
    if (r) lista.recargar();
  }
  async function pedirResumen() {
    setAprobado(false);
    const r = await ejecutar(() =>
      llamar<ResumenIA>('/ai/summaries', { metodo: 'POST', cuerpo: { requestIds: marcadas } }),
    );
    if (r) setResumen(r);
  }
  async function aprobar() {
    if (!resumen) return;
    const r = await ejecutar(() =>
      llamar(`/ai/summaries/${resumen.id}/approve`, { metodo: 'POST', cuerpo: {} }),
    );
    if (r) setAprobado(true);
  }
  function marcar(code: string, valor: boolean) {
    setMarcadas((m) => (valor ? [...m, code] : m.filter((c) => c !== code)));
  }

  return (
    <main>
      <h1>Bandeja del coordinador</h1>
      <div className="filtros">
        <div>
          <label htmlFor="f-estado">Estado</label>
          <select id="f-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {['BORRADOR', 'ENVIADA', 'RESERVADA', 'DESPACHADA', 'ENTREGADA', 'CANCELADA'].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </div>
        <div>
          <label htmlFor="f-prioridad">Prioridad</label>
          <select id="f-prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="">Todas</option>
            <option>NORMAL</option>
            <option>ALTA</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-zona">Zona</label>
          <select id="f-zona" value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Todas</option>
            {ZONAS.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      {lista.cargando && <p>Cargando…</p>}
      {lista.error && <Alerta>{lista.error}</Alerta>}
      {error && <Alerta>{error}</Alerta>}
      {lista.datos && <p>{lista.datos.total} solicitudes</p>}

      <ul className="lista">
        {lista.datos?.items.map((s) => (
          <li key={s.code} className="tarjeta" data-codigo={s.code}>
            <div className="fila">
              <strong>{s.code}</strong>
              <EtiquetaEstado estado={s.status} />
            </div>
            <p>
              {s.zone} · prioridad {s.priority} · requerida {fechaBogota(s.requiredDate)}
            </p>
            <div className="acciones">
              {s.status === 'ENVIADA' && (
                <>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={marcadas.includes(s.code)}
                      onChange={(e) => marcar(s.code, e.target.checked)}
                    />
                    Incluir {s.code} en el resumen
                  </label>
                  <button type="button" disabled={ocupado} onClick={() => reservar(s.code)}>
                    Reservar
                  </button>
                </>
              )}
              {s.status === 'DESPACHADA' && (
                <button type="button" disabled={ocupado} onClick={() => entregar(s.code)}>
                  Marcar entregada
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <section className="tarjeta" aria-labelledby="titulo-ia">
        <h2 id="titulo-ia">Asistente de IA</h2>
        <p>
          Seleccione hasta 20 solicitudes ENVIADA. El asistente solo sugiere; no reserva ni cambia
          nada.
        </p>
        <button
          type="button"
          disabled={ocupado || marcadas.length === 0 || marcadas.length > 20}
          onClick={pedirResumen}
        >
          Generar resumen
        </button>
        {resumen && (
          <article className="borrador" aria-label="Borrador del resumen">
            <p className="marca-ia">Generado con asistencia de IA · borrador</p>
            <p>
              Origen: <strong>{resumen.origen}</strong>
              {resumen.origen === 'ALTERNATIVO' ? ' (resumen automático sin IA)' : ''}
            </p>
            {resumen.aviso && <Aviso>{resumen.aviso}</Aviso>}
            <p>{resumen.resultado.summary}</p>
            <ul>
              {resumen.resultado.recommendations.map((r) => (
                <li key={r.requestId}>
                  <strong>{r.requestId}</strong>: {r.reason} (basado en{' '}
                  {r.evidenceFields.join(', ')})
                </li>
              ))}
            </ul>
            {aprobado ? (
              <Aviso>Resumen aprobado y registrado en la auditoría.</Aviso>
            ) : (
              <button type="button" disabled={ocupado} onClick={aprobar}>
                Aprobar
              </button>
            )}
          </article>
        )}
      </section>
    </main>
  );
}

// ---- bodega -------------------------------------------------------------------------------------

export function Bodega() {
  const lista = useCarga(
    () =>
      llamar<Pagina<Resumen>>('/requests', { consulta: { status: 'RESERVADA', pageSize: 100 } }),
    [],
  );
  const inv = useCarga(() => llamar<Tablero>('/dashboard'), []);
  const { ocupado, error, ejecutar } = useAccion();

  async function despachar(code: string) {
    const r = await ejecutar(() =>
      llamar<Detalle>(`/requests/${code}/dispatch`, { metodo: 'POST', cuerpo: {} }),
    );
    if (r) {
      lista.recargar();
      inv.recargar();
    }
  }

  return (
    <main>
      <h1>Bodega</h1>
      <h2>Solicitudes reservadas para despachar</h2>
      {lista.cargando && <p>Cargando…</p>}
      {lista.error && <Alerta>{lista.error}</Alerta>}
      {error && <Alerta>{error}</Alerta>}
      {lista.datos && lista.datos.items.length === 0 && (
        <Aviso>No hay solicitudes por despachar.</Aviso>
      )}
      <ul className="lista">
        {lista.datos?.items.map((s) => (
          <li key={s.code} className="tarjeta" data-codigo={s.code}>
            <div className="fila">
              <strong>{s.code}</strong>
              <EtiquetaEstado estado={s.status} />
            </div>
            <p>
              {s.zone} · prioridad {s.priority} · requerida {fechaBogota(s.requiredDate)}
            </p>
            <div className="acciones">
              <button type="button" disabled={ocupado} onClick={() => despachar(s.code)}>
                Despachar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {inv.datos?.inventory && <TablaInventario items={inv.datos.inventory} />}
    </main>
  );
}

// ---- auditoria ----------------------------------------------------------------------------------

export function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const r = useCarga(
    () => llamar<Pagina<EventoAuditoria>>('/audit', { consulta: { page: pagina, pageSize: 20 } }),
    [pagina],
  );
  const totalPaginas = r.datos ? Math.max(1, Math.ceil(r.datos.total / r.datos.pageSize)) : 1;
  return (
    <main>
      <h1>Auditoría</h1>
      {r.cargando && <p>Cargando…</p>}
      {r.error && <Alerta>{r.error}</Alerta>}
      {r.datos && r.datos.items.length === 0 && <Aviso>Todavía no hay eventos.</Aviso>}
      <ul className="lista">
        {r.datos?.items.map((e) => (
          <li key={e.id} className="tarjeta">
            <div className="fila">
              <strong>{e.action}</strong>
              <span>{fechaBogota(e.occurredAt)}</span>
            </div>
            <p>
              {e.resourceType} {e.resourceId}
              {e.fromStatus ? ` · ${e.fromStatus} → ${e.toStatus}` : ''}
            </p>
            <p className="tenue">
              Usuario {e.userId} · {e.orgId} · correlación {e.correlationId}
            </p>
          </li>
        ))}
      </ul>
      <div className="acciones">
        <button
          type="button"
          className="secundario"
          disabled={pagina <= 1}
          onClick={() => setPagina((p) => p - 1)}
        >
          Anterior
        </button>
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          className="secundario"
          disabled={pagina >= totalPaginas}
          onClick={() => setPagina((p) => p + 1)}
        >
          Siguiente
        </button>
      </div>
    </main>
  );
}

export { mensajeParaUsuario };
