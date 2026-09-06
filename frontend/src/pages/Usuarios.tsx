import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Boton } from '../components/ui/Boton';
import { Campo } from '../components/ui/Campo';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Alerta } from '../components/ui/Alerta';
import { Cargando } from '../components/ui/Estado';
import { TituloPagina } from '../components/ui/TituloPagina';
import type { CategoryOwner } from '@shared/types';

interface UsuarioFila {
  id: number;
  full_name: string;
  email: string;
  initials: string;
  role: 'usuario' | 'administrador';
  active: boolean;
}

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const { datos: usuarios, cargando, error, recargar } = useFetch<UsuarioFila[]>('/auth/usuarios');
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<UsuarioFila | null>(null);

  const activos = usuarios?.filter((u) => u.active).length ?? 0;

  return (
    <Layout>
            <TituloPagina
        titulo="Usuarios"
        subtitulo={`${activos} ${activos === 1 ? 'activo' : 'activos'}`}
      >
        <Boton variante="primario" onClick={() => setCreando(true)}>
          Nuevo usuario
        </Boton>
      </TituloPagina>

      {cargando && <Cargando />}
      {error && <Alerta>{error}</Alerta>}

      {usuarios && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left font-normal px-4 py-2.5">Nombre</th>
                <th className="w-16 font-normal px-2 py-2.5">Inic.</th>
                <th className="w-32 text-left font-normal px-2 py-2.5">Rol</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={`border-t border-slate-100 ${u.active ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{u.full_name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="text-center text-slate-600">{u.initials}</td>
                  <td className="px-2">
                    {u.role === 'administrador' ? (
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                        Administrador
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {u.active ? 'Usuario' : 'Inactivo'}
                      </span>
                    )}
                  </td>
                  <td className="text-right pr-4">
                    {u.id !== yo?.id && (
                      <button
                        onClick={() => setEditando(u)}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usuarios && <EncargadosPorCategoria usuarios={usuarios} />}

      <ModalUsuario
        abierto={creando}
        onCerrar={() => setCreando(false)}
        onGuardado={() => { setCreando(false); recargar(); }}
      />

      <ModalUsuario
        abierto={!!editando}
        usuario={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={() => { setEditando(null); recargar(); }}
      />
    </Layout>
  );
}

/** A quién se le avisa por correo cuando un paso de cada categoría queda pendiente */
function EncargadosPorCategoria({ usuarios }: { usuarios: UsuarioFila[] }) {
  const { datos: encargados, error, recargar } = useFetch<CategoryOwner[]>('/encargados');
  const [guardando, setGuardando] = useState<string | null>(null);

  async function cambiar(category: string, valor: string) {
    setGuardando(category);
    try {
      await api.put(`/encargados/${category}`, { userId: valor ? Number(valor) : null });
      recargar();
    } finally {
      setGuardando(null);
    }
  }

  if (!encargados) return null;

  const opciones = [
    { valor: '', etiqueta: 'Sin asignar' },
    ...usuarios.filter((u) => u.active).map((u) => ({ valor: String(u.id), etiqueta: u.full_name })),
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mt-5">
      <p className="text-sm font-medium text-slate-800">Encargados por categoría</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">
        Tipo de contrato, Podcast, Cuestionario final y Guías avisan a su encargado cuando uno de
        sus pasos queda "En proceso". "Jefe" es distinto: avisa de cualquier paso, de
        cualquier apartado, que quede "Pendiente jefe".
      </p>

      {error && <Alerta>{error}</Alerta>}

      <div className="grid sm:grid-cols-2 gap-3">
        {encargados.map((e) => (
          <Select
            key={e.category}
            etiqueta={e.label}
            opciones={opciones}
            value={e.userId ? String(e.userId) : ''}
            disabled={guardando === e.category}
            onChange={(ev) => cambiar(e.category, ev.target.value)}
          />
        ))}
      </div>
    </div>
  );
}

const ROLES = [
  { valor: 'usuario', etiqueta: 'Usuario' },
  { valor: 'administrador', etiqueta: 'Administrador' },
];

function ModalUsuario({
  abierto, usuario, onCerrar, onGuardado,
}: {
  abierto: boolean;
  usuario?: UsuarioFila | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = !!usuario;

  const [form, setForm] = useState({
    fullName: '', email: '', initials: '', role: 'usuario', password: '', active: true,
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Precarga los datos al abrir en modo edición
  const [idCargado, setIdCargado] = useState<number | null>(null);
  if (abierto && usuario && idCargado !== usuario.id) {
    setIdCargado(usuario.id);
    setForm({
      fullName: usuario.full_name,
      email: usuario.email,
      initials: usuario.initials,
      role: usuario.role,
      password: '',
      active: usuario.active,
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      if (esEdicion) {
        const cuerpo: any = {
          fullName: form.fullName,
          initials: form.initials,
          role: form.role,
          active: form.active,
        };
        if (form.password) cuerpo.password = form.password;
        await api.patch(`/auth/usuarios/${usuario!.id}`, cuerpo);
      } else {
        await api.post('/auth/usuarios', form);
        setForm({ fullName: '', email: '', initials: '', role: 'usuario', password: '', active: true });
      }
      onGuardado();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo={esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviar} className="space-y-4">
        <Campo
          etiqueta="Nombre completo"
          required
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />

        <Campo
          etiqueta="Correo"
          type="email"
          required
          disabled={esEdicion}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={esEdicion ? 'bg-slate-50 text-slate-500' : ''}
        />

        <div className="flex gap-3">
          <Campo
            etiqueta="Iniciales"
            required
            maxLength={4}
            placeholder="AG"
            value={form.initials}
            onChange={(e) => setForm({ ...form, initials: e.target.value.toUpperCase() })}
            className="uppercase"
          />
          <Select
            etiqueta="Rol"
            opciones={ROLES}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
        </div>

        <Campo
          etiqueta={esEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña'}
          type="password"
          required={!esEdicion}
          minLength={8}
          placeholder={esEdicion ? 'Dejar vacío para no cambiarla' : 'Mínimo 8 caracteres'}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {esEdicion && (
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm text-slate-700">Cuenta activa</span>
          </label>
        )}

        <Alerta>{error}</Alerta>

        <div className="flex gap-2 justify-end pt-1">
          <Boton type="button" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario" disabled={enviando}>
            {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}