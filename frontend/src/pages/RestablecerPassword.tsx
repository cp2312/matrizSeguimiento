import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Campo } from '../components/ui/Campo';
import { Boton } from '../components/ui/Boton';
import { Marca } from '../components/ui/Marca';
import { Alerta } from '../components/ui/Alerta';
import { Tarjeta } from '../components/ui/Tarjeta';
import '../styles/login_style.css';

export default function RestablecerPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [form, setForm] = useState({ password: '', confirmar: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres');
    }
    if (form.password !== form.confirmar) {
      return setError('Las contraseñas no coinciden');
    }

    setEnviando(true);
    try {
      await api.post('/auth/restablecer-password', { token, passwordNueva: form.password });
      setListo(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-fondo relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
      <img
        src="https://campusvirtual.santototunja.edu.co/assets/Copia-de-FInal-Logo-campusprueba2-2-1-scaled-CAabIrYv.png"
        alt=""
        aria-hidden="true"
        className="login-marca-agua pointer-events-none select-none absolute -right-28 -bottom-28 w-[620px] max-w-none"
      />

      <Tarjeta className="login-card relative z-10 w-full max-w-md border border-slate-300 dark:border-slate-700">
        <div className="h-1.5 bg-marca-600 dark:bg-marca-500" />
        <div className="p-10 sm:p-12">

          <div className="mb-8">
            <Marca />
          </div>

          {!token ? (
            <>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 text-center mb-1.5">
                Enlace incompleto
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8">
                Este enlace no trae el token de recuperación. Solicita uno nuevo.
              </p>
              <Link to="/olvido-password">
                <Boton type="button" variante="secundario" forma="pildora" ancho="completo">
                  Solicitar un enlace nuevo
                </Boton>
              </Link>
            </>
          ) : listo ? (
            <>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 text-center mb-1.5">
                Contraseña actualizada
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-2">
                Ya podés iniciar sesión con tu nueva contraseña. Te llevamos al login…
              </p>
            </>
          ) : (
            <form onSubmit={enviar}>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 text-center mb-1.5">
                Elegí una nueva contraseña
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8">
                Mínimo 8 caracteres
              </p>

              <div className="space-y-5">
                <Campo
                  etiqueta="Nueva contraseña"
                  variante="pildora"
                  type="password"
                  required
                  autoFocus
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <Campo
                  etiqueta="Confirmar contraseña"
                  variante="pildora"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={form.confirmar}
                  onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
                />
              </div>

              <div className="mt-4 min-h-5">
                <Alerta centrado>{error}</Alerta>
              </div>

              <Boton
                type="submit"
                variante="primario"
                forma="pildora"
                ancho="completo"
                disabled={enviando}
                className="mt-5 hover:shadow-md active:scale-[0.99]"
              >
                {enviando ? 'Guardando…' : 'Restablecer contraseña'}
              </Boton>

              <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 text-center">
                <Link to="/login" className="hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2">
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}
