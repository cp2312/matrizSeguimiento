# Matriz de Seguimiento

⚠️ Este proyecto recién está empezando. Por ahora es solo la "base" técnica: no tiene todavía las pantallas ni las funciones reales, es más como los cimientos de la casa antes de construir las habitaciones.

## ¿Qué hay hecho hasta ahora?

El proyecto se divide en 3 carpetas:

- **`backend/`** → el servidor (la parte que maneja los datos "por detrás", sin interfaz visual).
- **`frontend/`** → la página web que verá el usuario.
- **`shared/`** → una carpeta para código que en el futuro usarán tanto el backend como el frontend (por ahora está vacía).

Ahora mismo:

- El **backend** solo responde a una prueba (`/api/health`) que confirma que está encendido, y tiene preparada (pero sin usar todavía) la conexión en tiempo real para que, cuando alguien edite una matriz, los demás vean el cambio al instante sin recargar la página.
- El **frontend** solo muestra una pantalla simple con el título "Matriz de seguimiento". Todavía no está conectado al backend ni tiene ninguna funcionalidad real.

En resumen: **todavía no se puede usar la aplicación**, solo está el esqueleto sobre el que se va a construir.

## Con qué está hecho

- Backend: Node.js + Express (para el servidor) + Socket.io (para tiempo real).
- Frontend: React + Vite (para la página web) + Tailwind (para los estilos).
- Todo escrito en TypeScript.

## Cómo probarlo en tu computadora

1. Instalar las dependencias (una sola vez):
   ```bash
   npm install
   ```

2. Crear un archivo `backend/.env` con este contenido:
   ```
   PORT=4000
   CLIENT_ORIGIN=http://localhost:5173
   ```

3. Levantar todo (backend y frontend juntos):
   ```bash
   npm run dev
   ```

4. Abrir en el navegador:
   - Página web: http://localhost:5173
   - Prueba del servidor: http://localhost:4000/api/health (debería mostrar `{ ok: true }`)

Si quieres levantar solo uno de los dos:
```bash
npm run dev:api   # solo el servidor
npm run dev:web   # solo la página web
```

## Qué falta por hacer

- Diseñar cómo se van a guardar los datos de la matriz (todavía no hay base de datos).
- Hacer las pantallas reales del frontend.
- Conectar el frontend con el backend.
- Hacer que los cambios se vean en tiempo real entre usuarios (la parte técnica ya está preparada, pero no se usa todavía).
- Agregar inicio de sesión / usuarios.
