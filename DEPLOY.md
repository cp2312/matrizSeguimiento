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

## 11. CI/CD: que se actualice solo al hacer push a `main`

Con esto, cada vez que se sube algo a `main` en GitHub, un workflow de GitHub Actions entra por SSH al servidor y corre exactamente los mismos pasos de "Actualizar a una versión nueva" de arriba -- ya no hace falta conectarse a mano cada vez.

### 11.1 Generar una llave SSH solo para el deploy

En tu máquina (no en el servidor):

```bash
ssh-keygen -t ed25519 -C "deploy-matriz-seguimiento" -f ./deploy_key -N ""
```

Esto deja dos archivos: `deploy_key` (privada, nunca se sube a ningún lado) y `deploy_key.pub` (pública).

Copiar la pública al servidor, al usuario que ya usaste en los pasos 3-7 (el dueño de `/var/www/matriz-seguimiento`):

```bash
ssh-copy-id -i ./deploy_key.pub tu-usuario@tu-servidor
```

Probar que funciona antes de seguir:

```bash
ssh -i ./deploy_key tu-usuario@tu-servidor "echo listo"
```

### 11.2 Cargar los secretos en GitHub

En el repo: **Settings → Secrets and variables → Actions → New repository secret**. Crear estos tres:

| Nombre | Valor |
|---|---|
| `DEPLOY_HOST` | IP o dominio del servidor |
| `DEPLOY_USER` | el usuario SSH del paso anterior (el dueño de `/var/www/matriz-seguimiento`) |
| `DEPLOY_SSH_KEY` | el contenido completo de `deploy_key` (la privada) |

Después de cargarla, borrá `deploy_key`/`deploy_key.pub` de tu máquina o guardalas en un lugar seguro -- ya no las necesitás sueltas.

### 11.3 El workflow

Crear `.github/workflows/deploy.yml` en el repo:

```yaml
name: Deploy a producción

on:
  push:
    branches: [main]

# Si se hacen dos push seguidos, cancela el deploy anterior en vez de
# encolarlos -- siempre termina corriendo el más nuevo.
concurrency:
  group: deploy-produccion
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Conectar por SSH y actualizar el servidor
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            set -e
            cd /var/www/matriz-seguimiento

            ANTES=$(git rev-parse HEAD)
            git pull origin main
            npm install

            # Aviso si el pull trajo migraciones nuevas -- esas siempre se
            # aplican a mano con psql, el workflow no las corre solo.
            if ! git diff --quiet "$ANTES" HEAD -- backend/src/db/migrations/; then
              echo "⚠️  Hay migraciones nuevas en backend/src/db/migrations/ -- aplicalas a mano con psql antes de confiar en el deploy."
            fi

            npm run build -w backend
            npm run build -w frontend
            pm2 restart matriz-api
```

Con esto ya alcanza: hacer merge a `main` dispara el workflow, que compila y reinicia `matriz-api` solo. Se puede ver el progreso (y los logs, incluido el aviso de migraciones) en la pestaña **Actions** del repo.

<details>
<summary>Si el firewall del servidor no deja entrar SSH desde GitHub Actions</summary>

Los runners de GitHub Actions usan IPs que cambian, así que no se pueden dejar fijas en el firewall. Si el servidor solo acepta SSH desde IPs conocidas, hay dos salidas:

- Abrir el puerto SSH a cualquier IP pero **solo** para este usuario de deploy, con la llave de arriba (sin contraseña habilitada) y, si se puede, con `fail2ban` corriendo.
- Cambiar de enfoque: en vez de que GitHub entre al servidor, que el servidor "pregunte" solo cada tanto (`git fetch` + comparar contra `origin/main` en un cronjob o un timer de systemd) y se actualice si hay algo nuevo -- más lento que el push directo, pero no requiere abrir SSH hacia afuera.

</details>
