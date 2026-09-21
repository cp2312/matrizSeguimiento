---
name: run-matrizdeseguimiento
description: Build, run, and drive the Matriz de Seguimiento app (Express + Postgres backend, React/Vite frontend). Use when asked to start the app, run the backend or frontend dev servers, log in, take a screenshot of a page, or interact with its UI end to end.
---

Matriz de Seguimiento is a two-process web app: an Express + Socket.IO API
backed by Postgres (`backend/`), and a React/Vite SPA (`frontend/`) that
proxies `/api` and `/socket.io` to it. There's no test suite yet — for
agent use, "running" it means launching both dev servers and driving the
SPA headlessly with the Playwright script at
`.claude/skills/run-matrizdeseguimiento/driver.mjs`.

All paths below are relative to the repo root.

## Prerequisites

- Node.js (v20.17.0 verified here; Vite prints a warning wanting 20.19+/22.12+ but runs fine anyway — the warning is not fatal).
- PostgreSQL running locally, reachable with the credentials in `backend/.env`. Verified against PostgreSQL 16 on `localhost:5432`.
- A local Chrome or Edge install, for the driver (see below — it doesn't bundle its own browser).

## Setup

```bash
npm install   # root workspace install — installs backend/ and frontend/ deps too
```

`backend/.env` is gitignored and not in the repo — create it. The
committed README only lists `PORT`/`CLIENT_ORIGIN`; the code as it exists
now also requires `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`:

```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/matriz_seguimiento
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=8h
```

Database — create it and load the schema (verified clean on a scratch DB this session):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE matriz_seguimiento;"
psql -U postgres -h localhost -d matriz_seguimiento -f backend/src/db/schema.sql
```

You need at least one admin user to log in. `backend/package.json`'s
`crear-admin` script (`npx tsx src/db/crearAdmin.ts` from `backend/`) is
interactive (readline prompts) — fine for a human, useless for a script.
For a driver-usable account, insert one directly with a bcrypt hash:

```bash
node -e "require('bcrypt').hash('SkillDriver123', 10).then(h => console.log(h))"
# then, with that hash:
psql -U postgres -h localhost -d matriz_seguimiento -c "
INSERT INTO users (full_name, email, password_hash, initials, role)
VALUES ('Skill Driver Admin', 'skill-driver@example.test', '<hash>', 'SD', 'administrador');
"
```

On this machine that account already exists:
`skill-driver@example.test` / `SkillDriver123`.

Driver dependencies (separate from the app, self-contained):

```bash
cd .claude/skills/run-matrizdeseguimiento && npm install   # playwright-core only
```

## Build

```bash
cd frontend && npm run build   # tsc -b && vite build — verified clean
cd backend  && npx tsc -p tsconfig.json --noEmit   # verified clean
```

Not needed to run the dev servers below — only for a production check.

## Run (agent path)

Start both dev servers in the background, then drive the frontend with
the Playwright script:

```bash
npm run dev:api &> /tmp/api.log &
npm run dev:web &> /tmp/web.log &

# poll both — npm's background wrapper reports "done" long before the
# actual server is up (or even once the server itself is up, see Gotchas)
for i in $(seq 1 30); do
  curl -sf http://localhost:4000/api/health >/dev/null && curl -sf http://localhost:5173/ >/dev/null && break
  sleep 1
done
curl http://localhost:4000/api/health
# → {"ok":true,"asignaturas":0}
```

Drive it — pipe a whole script to `driver.mjs`'s stdin, one command per
line; it runs them in order and exits:

```bash
node .claude/skills/run-matrizdeseguimiento/driver.mjs <<'EOF'
nav /login
wait-for input[type=email]
fill input[type=email] skill-driver@example.test
fill input[type=password] SkillDriver123
click button[type=submit]
wait-for text=Aquí irá el listado
nav /usuarios
wait-for table
screenshot 03-usuarios
console --errors
EOF
```

Screenshots land in `.claude/skills/run-matrizdeseguimiento/screenshots/`
(override with `SCREENSHOT_DIR`). Base URL defaults to
`http://localhost:5173` (override with `BASE_URL`).

### Driver commands

| command | what it does |
|---|---|
| `nav <path-or-url>` | navigate (relative paths resolve against `BASE_URL`) |
| `wait-for <css-selector>` | wait up to 10s for a selector |
| `wait-for text=<text>` | wait up to 10s for matching visible text |
| `click <css-selector>` | click an element |
| `click-text <text>` | click the first button/link/etc. containing text |
| `fill <css-selector> <text...>` | fill an input (rest of the line is the value) |
| `press <key>` | keyboard press, e.g. `Escape`, `Enter` |
| `screenshot [name]` | full-page screenshot → `screenshots/<name>.png` |
| `eval <js>` | `page.evaluate(js)`, prints JSON |
| `text [css-selector]` | print `innerText` (whole body if no selector) |
| `url` | print current URL |
| `sleep <ms>` | blind wait — last resort, prefer `wait-for` |
| `console [--errors]` | dump captured console/pageerror messages |
| `quit` | close the browser (also happens automatically at EOF) |

Stop the dev servers by killing the port listeners (npm doesn't forward
signals to the process it spawned):

```bash
# Windows/git-bash — find PID on the port, then stop it:
netstat -ano | grep ":4000 .*LISTENING"   # note the PID in the last column
powershell -Command "Stop-Process -Id <pid> -Force"
# same for 5173
```

## Run (human path)

```bash
npm run dev   # concurrently runs backend + frontend — verified working
```

Open `http://localhost:5173`. Ctrl-C to stop (or kill the port listeners
as above if it lingers).

## Test

No test suite exists yet (`grep '"test"' */package.json` — nothing).
`frontend` has a lint script:

```bash
cd frontend && npm run lint
```

Runs clean (0 errors).

## Gotchas

- **`playwright-core` has no bundled browser.** `driver.mjs` points at a
  real Chrome/Edge install instead of downloading one — it checks
  `CHROME_PATH` then common Windows paths, and found
  `C:\Program Files\Google\Chrome\Application\chrome.exe` on this
  machine. On a box without Chrome/Edge, either set `CHROME_PATH` or
  swap to the full `playwright` package and `npx playwright install
  chromium`.
- **`npm run dev:api &` looks "completed" immediately** in this harness's
  background-command tracking even while the server keeps listening —
  `tsx watch` double-forks. Don't trust the task-completion notification;
  poll the port/health endpoint instead (as above).
- **Each `driver.mjs` invocation is a fresh browser — no session persists
  between runs.** `nav /usuarios` in a brand-new invocation just bounces
  you to `/login` (correctly — the app's route guard, `Protegida` in
  `App.tsx`, has no token to check). Log in and do the rest of the flow
  in the *same* script.
- **`wait-for text=...` on a page that just navigated can fire before the
  data fetch finishes.** `/usuarios` renders instantly with "Cargando…"
  and the table appears only after the `useFetch` call resolves — wait
  for `table`, not for page text that's present in the loading state too.
- **The `crear-admin` script is interactive** (`readline` prompts) and
  can't be scripted directly; use the `bcrypt.hash` + `INSERT` shown
  above for a driver-usable account instead.

## Troubleshooting

- **`ERROR: locator.click: Timeout 30000ms exceeded` on `click-text`**:
  usually means the page silently redirected (e.g. to `/login`) before
  the click ran, not that the selector is wrong. Check with the `url`
  command.
- **Vite prints `Vite requires Node.js version 20.19+ or 22.12+`**:
  cosmetic on this Node 20.17.0 install — `npm run dev` / `npm run build`
  both still work.
