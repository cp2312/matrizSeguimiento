# Matriz de Seguimiento

Aplicación web para hacerle seguimiento a la producción de contenidos de las asignaturas de un programa académico (OVAs, videos, podcasts, guías, libro, cuestionario final, etc.). Reemplaza la matriz que antes se llevaba en Excel: cada paso del proceso queda registrado con su estado, fecha, responsable y comentarios, y el equipo se entera en tiempo real y por correo cuando algo necesita atención.

## Qué hace

- **Programas y asignaturas.** Un programa agrupa asignaturas por semestre; puede ser presencial, presencial con alguna asignatura virtual, híbrido (con modalidad por asignatura) o virtual (indicando si es de pregrado o posgrado). Cada asignatura define, según sus créditos, cuántas OVAs, videos, guías e infografías le corresponden.
- **Matriz del proceso.** El proceso completo (19 bloques: derechos, contrato, libro, unidad gráfica, estructura, rutas, OVA, podcast, videos, infografía, cuestionario final, guías, syllabus, montaje a plataforma, etc.) vive en una sola plantilla compartida (`shared/pipelineTemplate.ts`), así que backend y frontend nunca se desincronizan sobre qué pasos existen. Cada paso lleva estado, fecha, iniciales del responsable y comentarios; algunos son puntos de decisión (¿hay ajustes?) que habilitan o saltan pasos siguientes.
- **Tablero por programa.** Vista consolidada de todas las asignaturas de un programa con el color de cada bloque y el % de avance, para detectar de un vistazo qué está atascado.
- **Tiempo real.** Los cambios en una matriz se ven al instante en todas las pestañas que la tengan abierta (Socket.IO), con bloqueo optimista para no pisar el trabajo de otra persona.
- **Avisos por correo**, cada uno a un encargado configurable por categoría:
  - Un paso que queda "pendiente equipo" o "pendiente jefe".
  - El contrato de un docente por vencer con la matriz todavía incompleta.
  - La fecha límite de un paso puntual (creación de guión, recepción por experto) por vencer.
  - "Envío para ajustes de experto" del libro: la fecha límite se calcula sola (fecha de envío + 4 días hábiles, sin contar sábados/domingos) y avisa si no se marca como terminado a tiempo.
- **Usuarios y roles.** Rol `usuario` (marca avances) y `administrador` (además gestiona programas, asignaturas, usuarios y encargados). Login con JWT y recuperación de contraseña por correo con enlace de un solo uso.

## Con qué está hecho

- **Backend:** Node.js + Express 5, PostgreSQL (`pg`), Socket.IO para tiempo real, JWT + bcrypt para autenticación, Nodemailer para los avisos por correo.
- **Frontend:** React 19 + Vite, React Router, Tailwind CSS.
- **Todo en TypeScript**, con `shared/` como única fuente de verdad de los tipos y la plantilla del proceso entre backend y frontend.

## Estructura

```
backend/    servidor Express: rutas, autenticación, correo, avisos automáticos, esquema y migraciones de la base
frontend/   aplicación React (Vite + Tailwind)
shared/     tipos y plantilla del proceso que usan backend y frontend por igual
```

## Cómo correrlo en tu computadora

### Necesitas

- Node.js (v20.19+/22.12+ recomendado; con 20.17 igual funciona, Vite solo saca un aviso).
- PostgreSQL corriendo localmente (o accesible por red).

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar el backend

Crear `backend/.env` a partir de `backend/.env.example`:

```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/matriz_seguimiento
JWT_SECRET=<cadena larga y aleatoria>
JWT_EXPIRES_IN=8h

# Opcional: sin esto, los avisos por correo simplemente se omiten (quedan en el log)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### 3. Crear la base de datos

```bash
psql -U postgres -h localhost -c "CREATE DATABASE matriz_seguimiento;"
psql -U postgres -h localhost -d matriz_seguimiento -f backend/src/db/schema.sql
```

`schema.sql` se aplica completo sobre una base vacía. Si en cambio ya tienes una base de un `main` anterior, corre en orden los archivos nuevos que falten en `backend/src/db/migrations/` (cada uno indica en su encabezado qué hace; son seguros de correr más de una vez).

### 4. Crear el primer usuario administrador

```bash
cd backend
npm run crear-admin
```
(Pide nombre, correo, iniciales y contraseña por consola.)

### 5. Levantar la aplicación

```bash
npm run dev          # backend + frontend juntos
# o por separado:
npm run dev:api       # solo el servidor (http://localhost:4000)
npm run dev:web       # solo la página web (http://localhost:5173)
```

Abrir `http://localhost:5173` e iniciar sesión con el usuario creado en el paso anterior.

`http://localhost:4000/api/health` responde `{ ok: true, asignaturas: <n> }` si el backend está bien conectado a la base.

## Otros scripts

```bash
cd frontend && npm run build   # build de producción (tsc -b && vite build)
cd frontend && npm run lint    # eslint
cd backend  && npm run build   # compila el backend a dist/
```
