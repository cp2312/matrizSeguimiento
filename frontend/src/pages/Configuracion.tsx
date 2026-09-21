import { useRef, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { TituloPagina } from '../components/ui/TituloPagina';
import { Avatar } from '../components/ui/Avatar';
import { CampoPassword } from '../components/ui/CampoPassword';
import { Boton } from '../components/ui/Boton';
import { Alerta } from '../components/ui/Alerta';

const MAX_FOTO_BYTES = 3 * 1024 * 1024;

export default function Configuracion() {
  const { usuario, actualizarAvatar } = useAuth();

  return (
    <Layout>
      <TituloPagina
        titulo="Configuración"
        subtitulo="Tu perfil y la seguridad de tu cuenta"
      />

      <div className="grid md:grid-cols-2 gap-5 items-start">
        <FotoPerfil nombre={usuario?.full_name ?? ''} iniciales={usuario?.initials ?? ''} avatarUrl={usuario?.avatar_url ?? null} onGuardar={actualizarAvatar} />
        <CambiarPassword />
      </div>
    </Layout>
  );
}

function FotoPerfil({
  nombre, iniciales, avatarUrl, onGuardar,
}: {
  nombre: string;
  iniciales: string;
  avatarUrl: string | null;
  onGuardar: (avatar: string | null) => Promise<string | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previo, setPrevio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const foto = previo ?? avatarUrl;

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    setExito(false);
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      setPrevio(null);
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      setError('La imagen pesa más de 3 MB');
      setPrevio(null);
      return;
    }

    setError('');
    const lector = new FileReader();
    lector.onload = () => setPrevio(lector.result as string);
    lector.readAsDataURL(archivo);
  }

  async function guardar() {
    if (!previo) return;
    setEnviando(true);
    setError('');
    setExito(false);
    try {
      await onGuardar(previo);
      setPrevio(null);
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setEnviando(false);
    }
  }

  async function quitar() {
    setEnviando(true);
    setError('');
    setExito(false);
    try {
      await onGuardar(null);
      setPrevio(null);
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Foto de perfil</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
        Elige una foto para que reemplace tus iniciales en el panel superior.
      </p>

      <div className="flex items-center gap-4">
        <Avatar nombre={nombre} iniciales={iniciales} avatarUrl={foto} tamano="xl" />
        <div className="space-y-2">
          <Boton variante="secundario" type="button" onClick={() => inputRef.current?.click()}>
            {foto ? 'Cambiar foto' : 'Subir foto'}
          </Boton>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={elegirArchivo}
          />
          {avatarUrl && (
            <div>
              <button
                type="button"
                onClick={quitar}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Quitar foto
              </button>
            </div>
          )}
        </div>
      </div>

      {previo && (
        <div className="mt-4 flex items-center gap-2">
          <Boton variante="primario" type="button" disabled={enviando} onClick={guardar}>
            {enviando ? 'Guardando…' : 'Guardar foto'}
          </Boton>
          <Boton variante="texto" type="button" disabled={enviando} onClick={() => setPrevio(null)}>
            Cancelar
          </Boton>
        </div>
      )}

      <div className="mt-3">
        <Alerta>{error}</Alerta>
        {exito && <Alerta tipo="info" centrado={false}>Foto actualizada</Alerta>}
      </div>
    </section>
  );
}

function CambiarPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setExito(false);

    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/auth/cambiar-password', { passwordActual: actual, passwordNueva: nueva });
      setActual('');
      setNueva('');
      setConfirmar('');
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">Contraseña</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1 mb-7">
        Actualiza la contraseña con la que inicias sesión
      </p>

      <form onSubmit={enviar} className="space-y-4">
        <CampoPassword etiqueta="Contraseña actual" valor={actual} onChange={setActual} />

        <CampoPassword
          etiqueta="Nueva contraseña"
          valor={nueva}
          onChange={setNueva}
          minLength={8}
          placeholder="Mínimo 8 caracteres"
        />

        <CampoPassword
          etiqueta="Confirmar nueva contraseña"
          valor={confirmar}
          onChange={setConfirmar}
          minLength={8}
        />

        <div className="min-h-5">
          <Alerta centrado>{error}</Alerta>
          {exito && <Alerta tipo="info" centrado>Contraseña actualizada correctamente</Alerta>}
        </div>

        <Boton
          variante="primario"
          type="submit"
          ancho="completo"
          disabled={enviando}
          className="bg-marca-600 hover:bg-marca-700 hover:shadow-md active:scale-[0.99]"
        >
          {enviando ? 'Guardando…' : 'Actualizar contraseña'}
        </Boton>
      </form>
    </section>
  );
}