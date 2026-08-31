import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useMatriz } from '../hooks/useMatriz';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando } from '../components/ui/Estado';
import { Casilla } from '../components/ui/Casilla';
import { Leyenda } from '../components/Leyenda';
import { ApartadosAsignatura } from '../components/ApartadosAsignatura';
import { agruparPasos } from '../lib/bloques';

export default function Asignatura() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { datos, cargando, error, aplicarCelda, recargar } = useMatriz(id);
  const [guardandoVideo, setGuardandoVideo] = useState(false);

  if (cargando) return <Layout><Cargando /></Layout>;
  if (error) return <Layout><Alerta>{error}</Alerta></Layout>;
  if (!datos) return null;

  const { asignatura, pasos, celdas, avance } = datos;
  const grupos = agruparPasos(pasos, { videoPorDocente: asignatura.videos_por_docente });

  async function cambiarVideoPorDocente(checked: boolean) {
    setGuardandoVideo(true);
    try {
      await api.patch(`/subjects/${asignatura.id}`, { videosPorDocente: checked });
      recargar();
    } finally {
      setGuardandoVideo(false);
    }
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
          <Link
            to={`/programas/${asignatura.program_id}`}
            className="text-[13px] text-slate-500 hover:text-slate-800"
          >
            ← {asignatura.semester}
          </Link>
        }
      >
        <span className="text-[13px] text-slate-500">
          {avance.terminados} de {avance.total} · {avance.porcentaje}%
        </span>
      </TituloPagina>

      <div className="flex flex-col gap-4 max-w-3xl">
        <Casilla
          etiqueta="Los videos los graba el profesor (se muestran como &quot;Video tutorial&quot;)"
          checked={asignatura.videos_por_docente}
          disabled={guardandoVideo}
          onChange={(e) => cambiarVideoPorDocente(e.target.checked)}
        />

        <ApartadosAsignatura
          subjectId={asignatura.id}
          grupos={grupos}
          celdas={celdas}
          teachers={asignatura.teachers}
          onGuardado={aplicarCelda}
          apartadoInicial={searchParams.get('apartado')}
        />
        <Leyenda />
      </div>
    </Layout>
  );
}