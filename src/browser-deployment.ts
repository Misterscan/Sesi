import * as fs from 'fs';
import * as path from 'path';
import type { Program } from './types';

export interface BrowserAsset { type: string; data: string }

const mimeTypes: Record<string, string> = {
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain', '.md': 'text/markdown', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac',
  '.mpeg': 'audio/mpeg', '.mpga': 'audio/mpeg', '.webm': 'audio/webm',
};

function walk(value: any, visit: (node: any) => void): void {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const item of Object.values(value)) {
    if (Array.isArray(item)) item.forEach(child => walk(child, visit));
    else if (item && typeof item === 'object') walk(item, visit);
  }
}

/** Collect static resources without copying source files or environment files. */
export function collectBrowserAssets(program: Program, file: string, assets: Record<string, BrowserAsset>, entryDirectory: string): void {
  const visited = new Set<string>();
  const include = (candidate: string, key: string): void => {
    const type = mimeTypes[path.extname(candidate).toLowerCase()];
    if (!type || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return;
    const asset = { type, data: fs.readFileSync(candidate).toString('base64') };
    assets[key.replace(/\\/g, '/').replace(/^\.\//, '')] ??= asset;
    const relative = path.relative(entryDirectory, candidate).replace(/\\/g, '/');
    if (!relative.startsWith('../')) assets[relative] ??= asset;
    if (visited.has(candidate)) return;
    visited.add(candidate);
    if (!['text/html', 'text/css'].includes(type)) return;
    const content = fs.readFileSync(candidate, 'utf8');
    const references = type === 'text/html'
      ? [...content.matchAll(/(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1])
      : [...content.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)].map(match => match[1]);
    for (const reference of references) {
      if (/^(?:[a-z]+:|\/|#)/i.test(reference)) continue;
      const name = reference.split(/[?#]/)[0];
      include(path.resolve(path.dirname(candidate), name), path.posix.join(path.posix.dirname(key), name));
    }
  };
  walk(program, node => {
    if (node.type !== 'Literal' || typeof node.value !== 'string' || path.isAbsolute(node.value)) return;
    const type = mimeTypes[path.extname(node.value).toLowerCase()];
    if (!type || node.value.includes('\n')) return;
    for (const base of [path.dirname(file), process.cwd()]) {
      const candidate = path.resolve(base, node.value);
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
      include(candidate, node.value);
      break;
    }
  });
}

/** Authentication header constants become runtime inputs, never public bundle literals. */
export function externalizeBrowserCredentials(program: Program, names: Set<string>): void {
  const constants = new Map<string, any[]>();
  walk(program, node => {
    const name = node.type === 'LetStatement' ? node.name
      : node.type === 'Assignment' && node.left.type === 'Identifier' ? node.left.name : undefined;
    if (name) {
      const values = constants.get(name) ?? [];
      values.push(node.type === 'LetStatement' ? node.value : node.right); constants.set(name, values);
    }
  });
  const resolve = (node: any, seen = new Set<string>()): string | undefined => {
    if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node?.type === 'Identifier' && !seen.has(node.name)) {
      const next = new Set(seen); next.add(node.name);
      return constants.get(node.name)?.map(value => resolve(value, next)).find(value => value !== undefined);
    }
    if (node?.type === 'BinaryOp' && node.operator === '+') {
      const left = resolve(node.left, seen), right = resolve(node.right, seen);
      if (left !== undefined && right !== undefined) return left + right;
    }
    return undefined;
  };
  const literals = new Map<string, string>();
  const replacements: Array<{ property: any; env: string }> = [];
  walk(program, node => {
    if (node.type !== 'ObjectLiteral') return;
    for (const property of node.properties) {
      if (!/^(authorization|x-api-secret|x-api-key|api-key|x-goog-api-key)$/i.test(property.key)) continue;
      const credential = resolve(property.value);
      if (!credential) continue;
      const env = 'SESI_' + property.key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      names.add(env);
      replacements.push({ property, env });
      // Also remove the original constant declaration from every emitted function.
      const collect = (value: any, seen = new Set<string>()): void => {
        if (value?.type === 'Identifier' && !seen.has(value.name)) {
          seen.add(value.name); constants.get(value.name)?.forEach(item => collect(item, new Set(seen)));
        } else if (value?.type === 'Literal' && typeof value.value === 'string' && value.value !== 'Bearer ') {
          literals.set(value.value, env);
        } else if (value?.type === 'BinaryOp') { collect(value.left, seen); collect(value.right, seen); }
      };
      collect(property.value);
    }
  });
  walk(program, node => {
    if (node.type === 'Literal' && literals.has(node.value)) {
      const env = literals.get(node.value)!;
      delete node.value; node.type = 'EnvLookupExpression'; node.variableName = env;
    }
  });
  for (const { property, env } of replacements) property.value = {
    type: 'EnvLookupExpression', variableName: env, line: property.value.line,
  };
}

export function hasBrowserServer(program: Program): boolean {
  let found = false;
  walk(program, node => {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'listen') found = true;
  });
  return found;
}

/** This function is embedded verbatim in classic service workers; no module await is required. */
export function browserServiceWorker(start: () => Promise<void>, metadata: { bypass: string[] }): void {
  const scope = globalThis as any;
  let dispatch: ((request: any) => Promise<any>) | undefined;
  let database: any;
  const environmentReady = new Promise<void>(resolve => {
    if (!scope.indexedDB) { scope.SESI_ENV = {}; resolve(); return; }
    const request = scope.indexedDB.open('sesi-runtime', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('environment');
    request.onerror = () => { scope.SESI_ENV = {}; resolve(); };
    request.onsuccess = () => {
      database = request.result;
      const read = database.transaction('environment').objectStore('environment').get(scope.registration.scope);
      read.onsuccess = () => { scope.SESI_ENV = read.result ?? {}; resolve(); };
      read.onerror = () => { scope.SESI_ENV = {}; resolve(); };
    };
  });
  scope.__sesiBrowserListen = (handler: (request: any) => Promise<any>) => { dispatch = handler; };
  const ready = environmentReady.then(start);
  // Register all listeners synchronously, before starting asynchronous Sesi execution.
  scope.addEventListener('install', (event: any) => event.waitUntil(ready.then(() => scope.skipWaiting())));
  scope.addEventListener('activate', (event: any) => event.waitUntil(ready.then(() => scope.clients.claim())));
  scope.addEventListener('message', (event: any) => {
    if (event.data?.type !== 'sesi:environment') return;
    event.waitUntil(environmentReady.then(async () => {
      scope.SESI_ENV = { ...scope.SESI_ENV, ...event.data.values };
      if (database) await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('environment', 'readwrite');
        transaction.objectStore('environment').put(scope.SESI_ENV, scope.registration.scope);
        transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
      });
      event.ports[0]?.postMessage({ ok: true });
    }).catch((error: any) => event.ports[0]?.postMessage({ error: error.message })));
  });
  scope.addEventListener('fetch', (event: any) => {
    const url = new URL(event.request.url);
    if (url.origin !== new URL(scope.registration.scope).origin
      || metadata.bypass.some(file => new URL(file, scope.registration.scope).pathname === url.pathname)) return;
    event.respondWith(ready.then(async () => {
      if (!dispatch) throw new Error('Sesi app did not register a request handler');
      const response = await dispatch(event.request);
      return response.status === 404 ? fetch(event.request) : response;
    }).catch((error: any) => new Response('Sesi app failed: ' + error.message, {
      status: 500, headers: { 'Content-Type': 'text/plain' },
    })));
  });
}

export function browserLaunchPage(script: string, credentials: string[]): string {
  const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const inputs = credentials.map(name => `<label>${escape(name.replace(/^SESI_/, '').replace(/_/g, ' '))}
    <input type="password" name="${escape(name)}" autocomplete="off" required></label>`).join('\n');
  const moduleUrl = JSON.stringify('./' + script).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sesi app</title><style>body{font:16px system-ui;max-width:32rem;margin:15vh auto;padding:24px}label,input{display:block}label{margin:16px 0}input{box-sizing:border-box;width:100%;padding:10px}button{padding:10px 20px}</style></head>
<body><p id="status">${credentials.length ? 'Enter your API credentials to open the app. They are stored in this browser.' : 'Opening app…'}</p>
${credentials.length ? '<form id="credentials">' + inputs + '<button>Open app</button></form>' : ''}
<script type="module">
const status = document.querySelector('#status');
async function openApp() { try { await import(${moduleUrl}); } catch (error) { status.textContent = error.message; } }
${credentials.length ? `document.querySelector('#credentials').addEventListener('submit', event => {
event.preventDefault(); const form = event.currentTarget;
globalThis.SESI_ENV = Object.fromEntries(new FormData(form));
form.querySelector('button').disabled = true;
openApp().finally(() => { form.querySelector('button').disabled = false; });
});` : 'await openApp();'}
</script></body></html>\n`;
}
