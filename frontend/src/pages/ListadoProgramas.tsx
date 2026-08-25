import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { Boton } from '../components/ui/Boton';
import { Campo } from '../components/ui/Campo';
import { AreaTexto } from '../components/ui/AreaTexto';
import { Casilla } from '../components/ui/Casilla';
import { Modal } from '../components/ui/Modal';
import { Alerta } from '../components/ui/Alerta';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Cargando, Vacio } from '../components/ui/Estado';
import type { Program } from '@shared/types';

export default function ListadoProgramas() {
  const { datos: programas, cargando, error, recargar } = useFetch<Program[]>('/programs');
  const [creando, setCreando] = useState(false);

  const activos = programas?.filter((p) => !p.archived).length ?? 0;

  return (
    <Layout>
      <TituloPagina
        titulo="Programas"
        subtitulo={`${activos} ${activos === 1 ? 'programa' : 'programas'}`}
      >
        <Boton variante="primario" onClick={() => setCreando(true)}>
          Nuevo programa
        </Boton>
      </TituloPagina>

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {!cargando && !error && programas?.length === 0 && (
        <Vacio mensaje="Todavía no hay programas.">
          <Boton variante="primario" onClick={() => setCreando(true)}>
            Crear el primero
          </Boton>
        </Vacio>
      )}

      {!cargando && programas && programas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {programas.map((p) => (
            <Link
              key={p.id}
              to={`/programas/${p.id}`}
              className={`block bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300
                          hover:shadow-sm transition-all ${p.archived ? 'opacity-50' : ''}`}
            >
              <p className="text-sm font-medium text-slate-800">{p.name}</p>
              {p.notes && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.notes}</p>
              )}
              <div className="flex items-center gap-1.5 mt-3">
                {p.is_hybrid && (
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Híbrido
                  </span>
                )}
                {p.archived && (
                  <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    Archivado
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <ModalNuevoPrograma
        abierto={creando}
        onCerrar={() => setCreando(false)}
        onCreado={() => { setCreando(false); recargar(); }}
      />
    </Layout>
  );
}

function ModalNuevoPrograma({
  abierto, onCerrar, onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}) {
  const [form, setForm] = useState({ name: '', notes: '', isHybrid: false });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      await api.post('/programs', form);
      setForm({ name: '', notes: '', isHybrid: false });
      onCreado();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nuevo programa" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo
          etiqueta="Nombre"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <AreaTexto
          etiqueta="Notas (opcional)"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <Casilla
          etiqueta="Programa híbrido"
          checked={form.isHybrid}
          onChange={(e) => setForm({ ...form, isHybrid: e.target.checked })}
        />

        <Alerta>{error}</Alerta>

        <div className="flex gap-2 justify-end pt-1">
          <Boton type="button" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear programa'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
