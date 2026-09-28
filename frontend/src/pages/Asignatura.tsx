import { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMatriz } from '../hooks/useMatriz';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/useAuth';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { ModalConfirmar } from '../components/ui/ModalConfirmar';
import { BotonConfirmar } from '../components/ui/BotonConfirmar';
import { Cargando } from '../components/ui/Estado';
import { Leyenda } from '../components/Leyenda';
import { DocentesAsignatura } from '../components/DocentesAsignatura';
import { ApartadosAsignatura } from '../components/ApartadosAsignatura';
import { ModalNuevaAsignatura } from '../components/ModalNuevaAsignatura';
import { ModalCopiasSeguridad } from '../components/ModalCopiasSeguridad';
import { descargarAsignaturaExcel } from '../lib/exportar';
import { agruparPasos } from '../lib/bloques';
import type { Program } from '@shared/types';

function IconoLapiz() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function IconoBasura() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconoDescarga() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function Asignatura() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { datos, cargando, error, aplicarCelda, aplicarTeachers, recargar } = useMatriz(id);
  const [editando, setEditando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState('');
  const [viendoBackups, setViendoBackups] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState('');

  // Hace falta el programa (no solo la asignatura) para saber si pide
  // modalidad o nombre del programa al editar -- mismo dato que ya usa
  // Programas.tsx al crear una asignatura nueva.
  const { datos: programa } = useFetch<Program>(datos ? `/programs/${datos.asignatura.program_id}` : null);

  if (cargando) return <Layout><Cargando /></Layout>;
  if (error) return <Layout><Alerta>{error}</Alerta></Layout>;
  if (!datos) return null;

  const { asignatura, pasos, celdas, avance } = datos;
  const grupos = agruparPasos(pasos, { videoPorDocente: asignatura.videos_por_docente });

  async function cambiarVideoPorDocente(checked: boolean) {
    await api.patch(`/subjects/${asignatura.id}`, { videosPorDocente: checked });
    recargar();
  }

  // FechaEntregaLibro (dentro de PanelCelda) ya guarda el cambio por su cuenta
  // -- esto solo refresca el resto de la página con el valor nuevo.
  function bookDueDateCambiada() {
    recargar();
  }

  async function exportarExcel() {
    setExportando(true);
    setErrorExportar('');
    try {
      await descargarAsignaturaExcel(asignatura.id, asignatura.name);
    } catch (err) {
      setErrorExportar(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setExportando(false);
    }
  }

  async function confirmarEliminar() {
    setBorrando(true);
    setErrorBorrado('');
    try {
      await api.del(`/subjects/${asignatura.id}`);
      navigate(`/programas/${asignatura.program_id}`);
    } catch (err) {
      setErrorBorrado(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setBorrando(false);
    }
  }

  const completa = avance.total > 0 && avance.terminados === avance.total;

  async function reiniciarMatriz() {
    await api.post(`/subjects/${asignatura.id}/reiniciar`, {});
    recargar();
  }

  const subtitulo = [
    `${asignatura.credits} ${asignatura.credits === 1 ? 'crédito' : 'créditos'}`,
    asignatura.modality === 'virtual' ? 'Virtual' : asignatura.modality === 'presencial' ? 'Presencial' : null,
    asignatura.teachers.map((t) => t.full_name).join(', '),
  ].filter(Boolean).join(' · ');

  return (
    <Layout>
      <TituloPagina
        titulo={asignatura.name}
        subtitulo={subtitulo}
        volver={
          <nav className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
            <Link to="/" className="hover:text-slate-800 dark:hover:text-slate-100">← Programas</Link>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <Link to={`/programas/${asignatura.program_id}`} className="hover:text-slate-800 dark:hover:text-slate-100">
              {programa?.name ?? asignatura.semester}
            </Link>
          </nav>
        }
      >
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          {avance.terminados} de {avance.total} · {avance.porcentaje}%
        </span>
        {completa && (
          <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Por ofertar
          </span>
        )}
        {completa && (
          <BotonConfirmar
            etiqueta="Reiniciar matriz"
            etiquetaConfirmar="Sí, reiniciar"
            titulo="Reiniciar matriz"
            mensaje={
              <>
                ¿Reiniciar la matriz de <strong>{asignatura.name}</strong>? Se borra todo el avance de los
                pasos y los docentes asignados -- queda como si el proceso empezara de nuevo, con la
                asignatura ya creada. Queda una copia de seguridad de cómo estaba
                {usuario?.role === 'administrador' ? ' (ver "Copias de seguridad")' : ''}.
              </>
            }
            variante="peligro"
            onConfirmar={reiniciarMatriz}
            className="h-8 px-2.5 text-[13px]"
          />
        )}
        {usuario?.role === 'administrador' && (
          <button
            onClick={() => setViendoBackups(true)}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] text-slate-500 dark:text-slate-400
                       hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            Copias de seguridad
          </button>
        )}
        <button
          onClick={exportarExcel}
          disabled={exportando}
          title="Descarga un Excel con la matriz de esta asignatura"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] text-slate-500 dark:text-slate-400
                     hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconoDescarga />
          {exportando ? 'Generando…' : 'Exportar Excel'}
        </button>
        <button
          onClick={() => setEditando(true)}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] text-slate-500 dark:text-slate-400
                     hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <IconoLapiz />
          Editar
        </button>
        <button
          onClick={() => setEliminando(true)}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] text-slate-500
                     hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <IconoBasura />
          Eliminar
        </button>
      </TituloPagina>

      {errorExportar && <Alerta>{errorExportar}</Alerta>}

      <div className="flex flex-col gap-4 max-w-3xl">
        <DocentesAsignatura
          subjectId={asignatura.id}
          teachers={asignatura.teachers}
          onCambiados={aplicarTeachers}
          onCeldaActualizada={aplicarCelda}
        />

        <ApartadosAsignatura
          subjectId={asignatura.id}
          grupos={grupos}
          celdas={celdas}
          quitadas={datos.quitadas}
          teachers={asignatura.teachers}
          videoPorDocente={asignatura.videos_por_docente}
          bookDueDate={asignatura.book_due_date}
          onGuardado={aplicarCelda}
          onTeachersChanged={aplicarTeachers}
          onCambiarVideoPorDocente={cambiarVideoPorDocente}
          onBookDueDateChanged={bookDueDateCambiada}
          apartadoInicial={searchParams.get('apartado')}
          onRecargar={recargar}
        />
        <Leyenda />
      </div>

      {programa && (
        <ModalNuevaAsignatura
          abierto={editando}
          programa={programa}
          asignatura={asignatura}
          onCerrar={() => setEditando(false)}
          onGuardada={() => { setEditando(false); recargar(); }}
        />
      )}

      <ModalConfirmar
        abierto={eliminando}
        titulo="Eliminar asignatura"
        mensaje={
          <>
            ¿Seguro que querés eliminar <strong>{asignatura.name}</strong>? Esto borra también
            todas sus celdas e historial. La acción no se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar"
        variante="peligro"
        enviando={borrando}
        error={errorBorrado}
        onCancelar={() => setEliminando(false)}
        onConfirmar={confirmarEliminar}
      />

      <ModalCopiasSeguridad
        abierto={viendoBackups}
        subjectId={asignatura.id}
        onCerrar={() => setViendoBackups(false)}
        onRestaurado={recargar}
      />
    </Layout>
  );
}
