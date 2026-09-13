import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Campo } from '../components/ui/Campo';
import { Boton } from '../components/ui/Boton';
import { Alerta } from '../components/ui/Alerta';
import { useTema } from '../context/TemaContext';

export default function Login() {
  const { login } = useAuth();
  const { tema, alternarTema } = useTema();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const destino = (location.state as { from?: string } | null)?.from ?? searchParams.get('from');
  const redirigirA = destino?.startsWith('/') ? destino : '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      await login(form.email, form.password);
      navigate(redirigirA, { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden
                    bg-slate-50 dark:bg-slate-950">
      <button
        type="button"
        onClick={alternarTema}
        title={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
        className="absolute top-5 right-6 w-9 h-9 grid place-items-center rounded-full
                   text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800
                   transition-colors"
      >
        {tema === 'oscuro' ? (
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      <div className="relative w-full max-w-5xl grid md:grid-cols-2 rounded-2xl overflow-hidden
                      bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                      shadow-xl shadow-slate-900/10">
        <div className="relative hidden md:block min-h-[560px]">
          <img
            src="https://campusvirtual.santototunja.edu.co/app/archivo/Login.jpg"
            alt="Campus Virtual"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
          <div className="absolute left-6 bottom-5 right-6">
            <div className="inline-flex items-center bg-white/95 dark:bg-slate-950/80
                            px-4 py-2.5 rounded-2xl shadow-lg shadow-slate-950/30 ring-1
                            ring-black/5 dark:ring-white/10 backdrop-blur-sm">
              <img
                src="https://campusvirtual.santototunja.edu.co/assets/Copia-de-FInal-Logo-campusprueba2-2-1-scaled-CAabIrYv.png"
                alt="Logo Campus Virtual"
                className="w-48 h-auto object-contain"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-12">
          <div className="mb-8 flex flex-col items-center md:hidden">
            <img
              src="https://campusvirtual.santototunja.edu.co/assets/Copia-de-FInal-Logo-campusprueba2-2-1-scaled-CAabIrYv.png"
              alt="Logo Campus Virtual"
              className="w-56 max-w-[75%] h-auto object-contain select-none dark:brightness-0 dark:invert"
            />
          </div>

          <div className="mb-8 hidden md:block">
            <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              MATRIZ DE
              <br />
              SEGUIMIENTO
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="h-px w-6 bg-marca-500 dark:bg-marca-400" />
              <p className="text-[11px] font-semibold uppercase text-marca-600 dark:text-marca-400 tracking-[0.25em]">
                Espacios académicos
              </p>
            </div>
          </div>

          <form onSubmit={enviar} className="w-full">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">
              Iniciar sesión
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1 mb-7">
              Ingrese con su correo institucional
            </p>

            <div className="space-y-4">
              <Campo
                etiqueta="Correo institucional"
                type="email"
                required
                autoFocus
                placeholder="usuario@usantoto.edu.co"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <div className="relative">
                <Campo
                  etiqueta="Contraseña"
                  type={verPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="pr-10"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verPassword}
                  className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600
                             dark:hover:text-slate-200 transition-colors"
                >
                  {verPassword ? (
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a19.4 19.4 0 0 1 4.22-5.94M9.9 4.24A10.87 10.87 0 0 1 12 4c7 0 10 8 10 8a19.5 19.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 min-h-5">
              <Alerta centrado>{error}</Alerta>
            </div>

            <Boton
              type="submit"
              variante="primario"
              ancho="completo"
              disabled={enviando}
              className="mt-4 bg-marca-600 hover:bg-marca-700 hover:shadow-md active:scale-[0.99]"
            >
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </Boton>

            <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 text-center">
              <Link to="/olvido-password" className="hover:text-marca-600 dark:hover:text-marca-400 underline underline-offset-2">
                ¿Olvidó su contraseña?
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
