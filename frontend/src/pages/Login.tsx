import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Campo } from '../components/ui/Campo';
import { Boton } from '../components/ui/Boton';
import { Marca } from '../components/ui/Marca';
import { Alerta } from '../components/ui/Alerta';
import { Tarjeta } from '../components/ui/Tarjeta';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      await login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">

      <div className="hidden lg:flex items-center justify-center bg-white p-12">
  <img
    src="/login2-image.svg"
    alt=""
    className="w-full h-full object-cover"
  />
</div>

      <div className="flex items-center justify-center p-6">
        <Tarjeta degradado className="w-full max-w-lg">
          <form onSubmit={enviar} className="p-18">

            <div className="mb-7">
              <Marca />
            </div>

            <h1 className="text-xl font-bold text-slate-800 text-center mb-6">
              Iniciar sesión
            </h1>

            <div className="space-y-6">
              <Campo
                etiqueta="Correo institucional"
                variante="pildora"
                type="email"
                required
                autoFocus
                placeholder="usuario@usantoto.edu.co"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <Campo
                etiqueta="Contraseña"
                variante="pildora"
                type="password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <div className="mt-4">
              <Alerta centrado>{error}</Alerta>
            </div>

            <Boton
              type="submit"
              variante="primario"
              forma="pildora"
              ancho="completo"
              disabled={enviando}
              className="mt-4"
            >
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </Boton>

            <p className="mt-4 text-xs text-slate-500 text-center">
              ¿Olvidó su contraseña? Contacte al administrador
            </p>

          </form>
        </Tarjeta>
      </div>
    </div>
  );
}