// Batch driver for the Matriz de Seguimiento web app (frontend + backend).
// Reads commands from stdin, one per line, and runs them in order against a
// headless Chromium page. No REPL/tmux needed — pipe a whole script in with
// a heredoc and read the transcript back; state (the open page) only lives
// for the duration of this one process.
//
// Usage:
//   node driver.mjs <<'EOF'
//   nav /login
//   wait-for input[type=email]
//   fill input[type=email] skill-driver@example.test
//   fill input[type=password] SkillDriver123
//   click button[type=submit]
//   wait-for text=Usuarios
//   screenshot 01-logged-in
//   console --errors
//   EOF
//
// Screenshots land in SCREENSHOT_DIR (default: ./screenshots next to this
// file). Base URL is BASE_URL (default http://localhost:5173).

import { chromium } from 'playwright-core';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SHOT_DIR = process.env.SCREENSHOT_DIR || path.join(HERE, 'screenshots');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
fs.mkdirSync(SHOT_DIR, { recursive: true });

// playwright-core has no bundled browser — point it at a real Chrome/Edge
// install instead of downloading one. Override with CHROME_PATH if needed.
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'No Chrome/Edge found. Set CHROME_PATH, or `npm install playwright` ' +
      'and `npx playwright install chromium` here instead of playwright-core.'
    );
  }
  return found;
}

let browser = null;
let page = null;
const consoleLog = [];

async function ensurePage() {
  if (page) return page;
  browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: Number(process.env.VIEWPORT_W) || 1280, height: Number(process.env.VIEWPORT_H) || 900 } });
  page = await context.newPage();
  page.on('console', (msg) => consoleLog.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLog.push(`[pageerror] ${err.message}`));
  return page;
}

function resolveUrl(u) {
  return /^https?:\/\//.test(u) ? u : BASE_URL + (u.startsWith('/') ? u : '/' + u);
}

const COMMANDS = {
  async nav(url) {
    const p = await ensurePage();
    await p.goto(resolveUrl(url), { waitUntil: 'domcontentloaded' });
    console.log('nav ->', resolveUrl(url));
  },

  async 'wait-for'(target) {
    const p = await ensurePage();
    try {
      if (target.startsWith('text=')) {
        await p.getByText(target.slice(5), { exact: false }).first().waitFor({ timeout: 10_000 });
      } else {
        await p.waitForSelector(target, { timeout: 10_000 });
      }
      console.log('found:', target);
    } catch {
      console.log('TIMEOUT:', target);
    }
  },

  async click(sel) {
    const p = await ensurePage();
    await p.click(sel);
    console.log('click', sel);
  },

  async hover(sel) {
    const p = await ensurePage();
    await p.hover(sel);
    console.log('hover', sel);
  },

  async 'click-text'(text) {
    const p = await ensurePage();
    await p.getByText(text, { exact: false }).first().click();
    console.log('click-text', JSON.stringify(text));
  },

  // "fill <selector> <text...>" — rest of the line after the selector is the value.
  async fill(rest) {
    const p = await ensurePage();
    const sp = rest.indexOf(' ');
    const sel = sp === -1 ? rest : rest.slice(0, sp);
    const value = sp === -1 ? '' : rest.slice(sp + 1);
    await p.fill(sel, value);
    console.log('fill', sel, '<-', JSON.stringify(value));
  },

  async press(key) {
    const p = await ensurePage();
    await p.keyboard.press(key);
    console.log('press', key);
  },

  async screenshot(name) {
    const p = await ensurePage();
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await p.screenshot({ path: f, fullPage: true });
    console.log('screenshot:', f);
  },

  async eval(expr) {
    const p = await ensurePage();
    try {
      console.log(JSON.stringify(await p.evaluate(expr)));
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  },

  async text(sel) {
    const p = await ensurePage();
    console.log(await p.evaluate(
      (s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null,
    ));
  },

  async url() {
    const p = await ensurePage();
    console.log(p.url());
  },

  async sleep(ms) {
    await new Promise((r) => setTimeout(r, Number(ms) || 500));
  },

  async console(flag) {
    const lines = flag === '--errors'
      ? consoleLog.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
      : consoleLog;
    if (lines.length === 0) console.log('(no console output captured)');
    else lines.forEach((l) => console.log(l));
  },

  async quit() {
    if (browser) await browser.close().catch(() => {});
    browser = null;
    page = null;
  },

  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '));
  },
};

const rl = readline.createInterface({ input: process.stdin, terminal: false });
let chain = Promise.resolve();

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const sp = trimmed.indexOf(' ');
  const cmd = sp === -1 ? trimmed : trimmed.slice(0, sp);
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1);
  const fn = COMMANDS[cmd];
  chain = chain.then(async () => {
    if (!fn) return console.log('unknown command:', cmd, '— try: help');
    try {
      await fn(rest);
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  });
});

rl.on('close', () => {
  chain.then(async () => {
    await COMMANDS.quit();
    process.exit(0);
  });
});
