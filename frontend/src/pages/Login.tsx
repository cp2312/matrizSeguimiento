import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Campo } from '../components/ui/Campo';
import { Boton } from '../components/ui/Boton';
import { Marca } from '../components/ui/Marca';
import { Alerta } from '../components/ui/Alerta';
import { Tarjeta } from '../components/ui/Tarjeta';
import '../styles/login_style.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // A dónde volver tras iniciar sesión: lo que guardó el guard de rutas (Protegida en
  // App.tsx) al entrar sin sesión, o el "?from=" que deja una sesión vencida (lib/api.ts)
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
    <div className="login-fondo relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
      <img
        src="/logo-usta1.png"
        alt=""
        aria-hidden="true"
        className="login-marca-agua pointer-events-none select-none absolute -right-28 -bottom-28 w-[620px] max-w-none"
      />

      <Tarjeta className="login-card relative z-10 w-full max-w-md border border-slate-300">
        <div className="h-1.5 bg-teal-600" />
        <form onSubmit={enviar} className="p-10 sm:p-12">

          <div className="mb-8">
            <Marca />
          </div>

          <h1 className="text-xl font-semibold text-slate-800 text-center mb-1.5">
            Iniciar sesión
          </h1>
          <p className="text-sm text-slate-500 text-center mb-8">
            Ingrese con su correo institucional
          </p>

          <div className="space-y-5">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-4 top-[38px] w-4 h-4 text-slate-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M4 4h16v16H4z" opacity="0" />
                <path d="M22 6 12 13 2 6" />
                <path d="M2 6h20v12H2z" />
              </svg>
              <Campo
                etiqueta="Correo institucional"
                variante="pildora"
                type="email"
                required
                autoFocus
                placeholder="usuario@usantoto.edu.co"
                className="pl-10"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="relative">
              <svg
                className="pointer-events-none absolute left-4 top-[38px] w-4 h-4 text-slate-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <Campo
                etiqueta="Contraseña"
                variante="pildora"
                type={verPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className="pl-10 pr-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verPassword}
                className="absolute right-3.5 top-[38px] text-slate-400 hover:text-slate-600
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500 rounded"
              >
                {verPassword ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a19.4 19.4 0 0 1 4.22-5.94M9.9 4.24A10.87 10.87 0 0 1 12 4c7 0 10 8 10 8a19.5 19.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
            forma="pildora"
            ancho="completo"
            disabled={enviando}
            className="mt-5 hover:shadow-md active:scale-[0.99]"
          >
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Boton>

          <p className="mt-5 text-xs text-slate-500 text-center">
            <Link to="/olvido-password" className="hover:text-slate-700 underline underline-offset-2">
              ¿Olvidó su contraseña?
            </Link>
          </p>

        </form>
      </Tarjeta>
    </div>
  );
}
