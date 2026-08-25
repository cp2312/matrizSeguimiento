import { Fragment, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { Layout } from '../components/Layout';
import { Boton } from '../components/ui/Boton';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando, Vacio } from '../components/ui/Estado';
import { Leyenda } from '../components/Leyenda';
import { ModalNuevaAsignatura } from '../components/ModalNuevaAsignatura';
import { ESTADOS, estadoDelBloque } from '../lib/estados';
import { COLUMNAS_TABLERO } from '../lib/bloques';
import type { CellStatus, Program, Subject } from '@shared/types';

interface FilaTablero extends Subject {
  estadosPorBloque: Record<string, CellStatus[]>;
  avance: number;
}

export default function Programa() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modalAbierto, setModalAbierto] = useState(false);

  const { datos: programa } = useFetch<Program>(`/programs/${id}`);
  const { datos: filas, cargando, error, recargar } = useFetch<FilaTablero[]>(`/programs/${id}/tablero`);

  // Agrupa por semestre para las filas separadoras
  const porSemestre = (filas ?? []).reduce<Record<string, FilaTablero[]>>((acc, f) => {
    (acc[f.semester] ??= []).push(f);
    return acc;
  }, {});

  const total = filas?.length ?? 0;

  return (
    <Layout>
      <TituloPagina
        titulo={programa?.name ?? '…'}
        subtitulo={`${total} ${total === 1 ? 'asignatura' : 'asignaturas'}`}
        volver={
          <Link to="/" className="text-[13px] text-slate-500 hover:text-slate-800">
            ← Programas
          </Link>
        }
      >
        <Boton variante="primario" onClick={() => setModalAbierto(true)}>
          Nueva asignatura
        </Boton>
      </TituloPagina>

      {cargando && <Cargando />}

      {error && <Alerta>{error}</Alerta>}

      {!cargando && !error && total === 0 && (
        <Vacio mensaje="Este programa aún no tiene asignaturas.">
          <Boton variante="primario" onClick={() => setModalAbierto(true)}>
            Crear la primera
          </Boton>
        </Vacio>
      )}

      {!cargando && total > 0 && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 900 }}>
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="text-left font-normal px-4 py-2.5 sticky left-0 bg-slate-50 min-w-[180px]">
                    Asignatura
                  </th>
                  <th className="font-normal px-1 py-2.5 w-9">Cr</th>
                  {COLUMNAS_TABLERO.map((c) => (
                    <th key={c.key} title={c.label} className="font-normal px-1 py-2.5">
                      {c.corta}
                    </th>
                  ))}
                  <th className="text-right font-normal px-4 py-2.5 w-14">%</th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(porSemestre).map(([semestre, asignaturas]) => (
                  <Fragment key={semestre}>
                    <tr>
                      <td
                        colSpan={COLUMNAS_TABLERO.length + 3}
                        className="bg-slate-50 px-4 py-1.5 text-[11px] text-slate-400 border-t border-slate-100"
                      >
                        {semestre}
                      </td>
                    </tr>

                    {asignaturas.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => navigate(`/asignaturas/${a.id}`)}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-4 py-2 sticky left-0 bg-white text-slate-800">
                          {a.name}
                          {a.modality && (
                            <span className="ml-1.5 text-[10px] text-slate-400">
                              {a.modality === 'virtual' ? 'V' : 'P'}
                            </span>
                          )}
                        </td>
                        <td className="text-center text-slate-500">{a.credits}</td>

                        {COLUMNAS_TABLERO.map((c) => {
                          const estado = estadoDelBloque(a.estadosPorBloque[c.key] ?? []);
                          const e = ESTADOS[estado];
                          return (
                            <td key={c.key} className="px-1 py-1.5">
                              <div
                                title={`${c.label}: ${e.label}`}
                                className="h-5 rounded"
                                style={{
                                  background: e.fondo,
                                  border: e.borde ? '0.5px solid rgba(0,0,0,.12)' : 'none',
                                }}
                              />
                            </td>
                          );
                        })}

                        <td className="text-right px-4 text-slate-500">{a.avance}%</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <Leyenda />
        </>
      )}

      {programa && (
        <ModalNuevaAsignatura
          abierto={modalAbierto}
          programa={programa}
          onCerrar={() => setModalAbierto(false)}
          onCreada={() => { setModalAbierto(false); recargar(); }}
        />
      )}
    </Layout>
  );
}