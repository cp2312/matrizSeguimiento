# Desplegar en un servidor Linux (producción)

Guía corta para subir esto a un servidor Ubuntu/Debian desde cero. La app tiene dos partes que se despliegan distinto:

- **`backend/`** → se compila a JavaScript y corre como un proceso Node siempre encendido (API + Socket.IO), escuchando solo en `localhost`.
- **`frontend/`** → se compila a archivos estáticos (HTML/JS/CSS) que sirve Nginx directamente.

Nginx queda al frente de todo: sirve el frontend y reenvía `/api` y `/socket.io` al proceso Node. Así el navegador solo habla con un dominio.

```
Internet → Nginx (80/443) → /              → frontend/dist (archivos estáticos)
                           → /api, /socket.io → Node (127.0.0.1:4000)
                                              → PostgreSQL (localhost:5432)
```

## 0. Antes de empezar

- Un servidor Linux (Ubuntu 22.04/24.04 sirve) con acceso `sudo`.
- Un dominio apuntando (registro DNS tipo A) a la IP del servidor -- hace falta para HTTPS.
- Node.js **20.19+ o 22.12+** (el proyecto funciona con 20.17 pero Vite avisa; mejor usar una versión soportada en el servidor).

## 1. Paquetes del sistema

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL, Nginx, Git
sudo apt install -y postgresql nginx git

# PM2 -- mantiene el proceso Node corriendo y lo reinicia si se cae o si el servidor reinicia
sudo npm install -g pm2
```

## 2. Base de datos

```bash
sudo -u postgres psql -c "CREATE DATABASE matriz_seguimiento;"
sudo -u postgres psql -c "CREATE USER matriz_app WITH PASSWORD 'PON-UNA-CONTRASEÑA-FUERTE-AQUI';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE matriz_seguimiento TO matriz_app;"
sudo -u postgres psql -d matriz_seguimiento -c "GRANT ALL ON SCHEMA public TO matriz_app;"
```

## 3. Traer el código

```bash
sudo mkdir -p /var/www/matriz-seguimiento
sudo chown $USER:$USER /var/www/matriz-seguimiento
git clone https://github.com/cp2312/matrizSeguimiento.git /var/www/matriz-seguimiento
cd /var/www/matriz-seguimiento
npm install
```

## 4. Configurar el backend

Crear `backend/.env` (no viene en el repo):

```bash
nano backend/.env
```

```
PORT=4000
CLIENT_ORIGIN=https://tu-dominio.com
DATABASE_URL=postgresql://matriz_app:PON-UNA-CONTRASEÑA-FUERTE-AQUI@localhost:5432/matriz_seguimiento
JWT_SECRET=<generar con: openssl rand -base64 48>
JWT_EXPIRES_IN=8h

# Correo de avisos -- opcional. Con SMTP_USER/SMTP_PASS vacíos, el envío se
# omite (queda en el log) sin romper nada.
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Generar el `JWT_SECRET`:

```bash
openssl rand -base64 48
```

## 5. Cargar el esquema y crear el primer administrador

```bash
psql "postgresql://matriz_app:TU-CONTRASEÑA@localhost:5432/matriz_seguimiento" -f backend/src/db/schema.sql

cd backend
npm run crear-admin   # pide nombre, correo, iniciales y contraseña por consola
cd ..
```

> Si en el futuro actualizás el código y `schema.sql` cambió, revisá `backend/src/db/migrations/` -- ahí quedan los cambios sueltos para aplicar a una base que ya tiene datos (cada archivo explica qué hace en su encabezado). `schema.sql` solo se usa completo la primera vez, sobre una base vacía.

## 6. Compilar

```bash
npm run build -w backend     # backend/dist/backend/src/index.js
npm run build -w frontend    # frontend/dist/  (estáticos)
```

## 7. Levantar el backend con PM2

```bash
cd backend
pm2 start dist/backend/src/index.js --name matriz-api
cd ..

pm2 save
pm2 startup   # imprime un comando -- copiarlo y correrlo para que arranque solo si el servidor reinicia
```

Comandos útiles después:

```bash
pm2 status
pm2 logs matriz-api
pm2 restart matriz-api
```

## 8. Nginx

```bash
sudo nano /etc/nginx/sites-available/matriz-seguimiento
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    root /var/www/matriz-seguimiento/frontend/dist;
    index index.html;

    # SPA: cualquier ruta que no sea un archivo cae en index.html (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/matriz-seguimiento /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS (Let's Encrypt, gratis)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

Certbot edita el `server` de arriba para escuchar en 443 y renovar el certificado solo. Después de esto, actualizá `CLIENT_ORIGIN` en `backend/.env` a `https://tu-dominio.com` si no lo habías puesto así, y `pm2 restart matriz-api`.

## 10. Verificar

```bash
curl https://tu-dominio.com/api/health
# {"ok":true,"asignaturas":0}
```

Abrir `https://tu-dominio.com` en el navegador e iniciar sesión con el administrador creado en el paso 5.

## Actualizar a una versión nueva

```bash
cd /var/www/matriz-seguimiento
git pull
npm install
# si hay migraciones nuevas en backend/src/db/migrations/, aplicarlas a mano con psql
npm run build -w backend
npm run build -w frontend
pm2 restart matriz-api
```

Nginx no necesita reiniciarse para los cambios del frontend -- son archivos estáticos, se ven apenas termina el `build`.
