'use strict';

const { app, BrowserWindow, net, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const origin = 'app://local';
const content = path.join(__dirname, 'web');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function asset(request) {
  const url = new URL(request.url);
  if (url.host !== 'local') return new Response('Not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return new Response('Invalid path', { status: 400 }); }
  if (pathname.includes('\\') || pathname.includes('\0')) return new Response('Invalid path', { status: 400 });
  const file = path.resolve(content, `.${pathname}`);
  const relative = path.relative(content, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return new Response('Not found', { status: 404 });
  }
  const info = await fs.stat(file).catch(() => null);
  if (info?.isFile()) return net.fetch(pathToFileURL(file).href, { method: request.method });
  if (pathname === '/' || (request.headers.get('accept') || '').includes('text/html')) {
    return net.fetch(pathToFileURL(path.join(content, 'index.html')).href, { method: request.method });
  }
  return new Response('Not found', { status: 404 });
}

function openWindow() {
  const window = new BrowserWindow({
    width: 1100, height: 760,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    const url = new URL(target);
    if (url.protocol !== 'app:' || url.host !== 'local') event.preventDefault();
  });
  void window.loadURL(`${origin}/`).catch(error => { console.error(error); app.exit(1); });
}

app.whenReady().then(() => {
  protocol.handle('app', asset);
  openWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openWindow(); });
}).catch(error => { console.error(error); app.exit(1); });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
