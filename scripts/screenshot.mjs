import { _electron as electron } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = '/tmp/dev-launcher-shots';
mkdirSync(SHOTS, { recursive: true });

const electronBin = process.platform === 'darwin'
  ? resolve(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
  : resolve(APP_DIR, 'node_modules/electron/dist/electron');

console.log('Launching Dev Launcher…');

const app = await electron.launch({
  executablePath: electronBin,
  args: [APP_DIR],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  timeout: 30_000,
});

// Wait for the window to fully render
await new Promise(r => setTimeout(r, 5000));

const page = app.windows().find(w => !w.url().startsWith('devtools://'))
  ?? await app.firstWindow();

console.log('Window URL:', page.url());

// Screenshot 1: initial empty state
const shot1 = `${SHOTS}/01-empty-state.png`;
await page.screenshot({ path: shot1 });
console.log('Screenshot 1:', shot1);

// Click "Manage" to open the workspace manager
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Manage'));
  btn?.click();
});
await new Promise(r => setTimeout(r, 600));

const shot2 = `${SHOTS}/02-manage-dialog.png`;
await page.screenshot({ path: shot2 });
console.log('Screenshot 2:', shot2);

await app.close();
console.log('Done.');
