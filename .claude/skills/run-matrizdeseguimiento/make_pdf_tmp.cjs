const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const exe = CHROME_PATHS.find((p) => fs.existsSync(p));
if (!exe) {
  console.error('No browser found');
  process.exit(1);
}

const htmlPath = 'C:\\Users\\usaurio\\AppData\\Local\\Temp\\claude\\c--Users-usaurio-Documents-Practicas20262-MatrizDeSeguimiento\\1d5b2f0d-1850-4e18-a8c7-f2b420362372\\scratchpad\\deploy-final.html';
const outPath = 'C:\\Users\\usaurio\\AppData\\Local\\Temp\\claude\\c--Users-usaurio-Documents-Practicas20262-MatrizDeSeguimiento\\1d5b2f0d-1850-4e18-a8c7-f2b420362372\\scratchpad\\Despliegue-Matriz-de-Seguimiento.pdf';

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' },
  });
  await browser.close();
  console.log('PDF written to', outPath);
})();
