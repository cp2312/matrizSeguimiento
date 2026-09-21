import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Campo } from '../components/ui/Campo';
import { Boton } from '../components/ui/Boton';
import { Alerta } from '../components/ui/Alerta';
import { useTema } from '../context/useTema';

export default function OlvidoPassword() {
  const { tema, alternarTema } = useTema();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      // El backend responde igual exista o no esa cuenta, para no revelar
      // qué correos están registrados.
      await api.post('/auth/olvido-password', { email });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
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
            <div className="inline-flex items-center bg-white/95 dark:bg-white/95
                            px-4 py-2.5 rounded-2xl shadow-lg shadow-slate-950/30 ring-1
                            ring-black/5 dark:ring-black/10 backdrop-blur-sm">
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
              className="w-56 max-w-[75%] h-auto object-contain select-none dark:bg-white dark:rounded-2xl dark:px-6 dark:py-3"
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

          {enviado ? (
            <div className="w-full">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">
                Revisa tu correo
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1 mb-7">
                Si <span className="font-medium text-slate-600 dark:text-slate-300">{email}</span> tiene una cuenta,
                te enviamos un enlace para restablecer la contraseña. Vence en 1 hora.
              </p>
              <Link to="/login">
                <Boton
                  type="button"
                  variante="primario"
                  ancho="completo"
                  className="bg-marca-600 hover:bg-marca-700 hover:shadow-md active:scale-[0.99]"
                >
                  Volver a iniciar sesión
                </Boton>
              </Link>
            </div>
          ) : (
            <form onSubmit={enviar} className="w-full">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">
                ¿Olvidó su contraseña?
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1 mb-7">
                Ingrese su correo y le enviaremos un enlace para restablecerla
              </p>

              <Campo
                etiqueta="Correo institucional"
                type="email"
                required
                autoFocus
                placeholder="usuario@usantoto.edu.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

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
                {enviando ? 'Enviando…' : 'Enviar enlace'}
              </Boton>

              <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 text-center">
                <Link to="/login" className="hover:text-marca-600 dark:hover:text-marca-400 underline underline-offset-2">
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
