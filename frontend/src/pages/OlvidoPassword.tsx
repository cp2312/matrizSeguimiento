import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Campo } from '../components/ui/Campo';
import { Boton } from '../components/ui/Boton';
import { Marca } from '../components/ui/Marca';
import { Alerta } from '../components/ui/Alerta';
import { Tarjeta } from '../components/ui/Tarjeta';
import '../styles/login_style.css';

export default function OlvidoPassword() {
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

          {enviado ? (
            <>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 text-center mb-1.5">
                Revisa tu correo
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8">
                Si <span className="font-medium text-slate-600 dark:text-slate-300">{email}</span> tiene una cuenta,
                te enviamos un enlace para restablecer la contraseña. Vence en 1 hora.
              </p>
              <Link to="/login">
                <Boton type="button" variante="secundario" forma="pildora" ancho="completo">
                  Volver a iniciar sesión
                </Boton>
              </Link>
            </>
          ) : (
            <form onSubmit={enviar}>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 text-center mb-1.5">
                ¿Olvidó su contraseña?
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8">
                Ingrese su correo y le enviaremos un enlace para restablecerla
              </p>

              <Campo
                etiqueta="Correo institucional"
                variante="pildora"
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
                forma="pildora"
                ancho="completo"
                disabled={enviando}
                className="mt-5 hover:shadow-md active:scale-[0.99]"
              >
                {enviando ? 'Enviando…' : 'Enviar enlace'}
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
