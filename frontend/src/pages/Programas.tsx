import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { Boton } from '../components/ui/Boton';
import { Campo } from '../components/ui/Campo';
import { Modal } from '../components/ui/Modal';
import { Alerta } from '../components/ui/Alerta';
import { Cargando, Vacio } from '../components/ui/Estado';
import type { Program } from '@shared/types';

export default function Programas() {
  const navigate = useNavigate();
  const { datos: programas, cargando, error, recargar } = useFetch<Program[]>('/programs');
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-medium text-slate-800">Programas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {programas?.length ?? 0} {programas?.length === 1 ? 'activo' : 'activos'}
          </p>
        </div>
        <Boton onClick={() => setModalAbierto(true)}>Nuevo programa</Boton>
      </div>

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {programas?.length === 0 && (
        <Vacio mensaje="Aún no hay programas registrados.">
          <Boton variante="primario" onClick={() => setModalAbierto(true)}>
            Crear el primero
          </Boton>
        </Vacio>
      )}

      <div className="flex flex-col gap-2">
        {programas?.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/programas/${p.id}`)}
            className="text-left bg-white border border-slate-200 rounded-xl p-4
                       hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-slate-800">{p.name}</p>
                {p.is_hybrid && (
                  <span className="inline-block mt-1 text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                    Híbrido
                  </span>
                )}
              </div>
            </div>
            {p.notes && (
              <p className="mt-2 text-xs text-slate-500 line-clamp-2">{p.notes}</p>
            )}
          </button>
        ))}
      </div>

      <ModalNuevoPrograma
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onCreado={() => { setModalAbierto(false); recargar(); }}
      />
    </Layout>
  );
}

function ModalNuevoPrograma({
  abierto, onCerrar, onCreado,
}: { abierto: boolean; onCerrar: () => void; onCreado: () => void }) {
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
          etiqueta="Nombre del programa"
          required
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <label className="block">
          <span className="block text-sm text-slate-600 mb-1.5">
            Notas de especificaciones
          </span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                       outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isHybrid}
            onChange={(e) => setForm({ ...form, isHybrid: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">
            Tiene asignaturas presenciales y virtuales
          </span>
        </label>

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