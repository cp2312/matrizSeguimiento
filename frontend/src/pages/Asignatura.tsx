import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useMatriz } from '../hooks/useMatriz';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando } from '../components/ui/Estado';
import { Leyenda } from '../components/Leyenda';
import { DocentesAsignatura } from '../components/DocentesAsignatura';
import { ApartadosAsignatura } from '../components/ApartadosAsignatura';
import { ModalNuevaAsignatura } from '../components/ModalNuevaAsignatura';
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

export default function Asignatura() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { datos, cargando, error, aplicarCelda, aplicarTeachers, recargar } = useMatriz(id);
  const [editando, setEditando] = useState(false);

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
        <button
          onClick={() => setEditando(true)}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] text-slate-500 dark:text-slate-400
                     hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <IconoLapiz />
          Editar
        </button>
      </TituloPagina>

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
          teachers={asignatura.teachers}
          videoPorDocente={asignatura.videos_por_docente}
          onGuardado={aplicarCelda}
          onTeachersChanged={aplicarTeachers}
          onCambiarVideoPorDocente={cambiarVideoPorDocente}
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
    </Layout>
  );
}
