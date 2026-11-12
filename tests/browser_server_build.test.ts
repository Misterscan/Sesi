import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { compileSesiForBrowser } from '../src/browser-compiler';

function browserStorage() {
  const files = new Map<string, Uint8Array>();
  const folders = new Set(['']);
  const missing = () => Object.assign(new Error('Not found'), { name: 'NotFoundError' });
  const directory = (prefix: string): any => ({
    async getDirectoryHandle(name: string, { create = false } = {}) {
      const key = prefix + name + '/';
      if (!folders.has(key)) { if (!create) throw missing(); folders.add(key); }
      return directory(key);
    },
    async getFileHandle(name: string, { create = false } = {}) {
      const key = prefix + name;
      if (!files.has(key)) { if (!create) throw missing(); files.set(key, new Uint8Array()); }
      return {
        async getFile() { return new Blob([files.get(key)!]); },
        async createWritable() { return { async write(value: string | Uint8Array) {
          files.set(key, typeof value === 'string' ? new TextEncoder().encode(value) : value);
        }, async close() {} }; },
      };
    },
  });
  return { navigator: { storage: { getDirectory: async () => directory('') } }, files };
}

async function startWorker(result: ReturnType<typeof compileSesiForBrowser>, externalFetch: typeof fetch) {
  assert.ok(result.worker);
  const listeners: Record<string, Function> = {};
  const storage = browserStorage();
  const environment = {
    URL, Request, Response, Blob, Uint8Array, TextEncoder, atob, btoa, setTimeout,
    console: { log() {} }, navigator: storage.navigator,
    location: { href: 'https://example.test/apps/' + path.basename(result.worker) },
    registration: { scope: 'https://example.test/apps/' },
    clients: { claim: async () => {} }, skipWaiting: async () => {},
    addEventListener(type: string, listener: Function) { listeners[type] = listener; },
    fetch: async (input: any, options?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (result.assets && url.endsWith(path.basename(result.assets))) {
        return new Response(fs.readFileSync(result.assets), { headers: { 'Content-Type': 'application/json' } });
      }
      return externalFetch(input, options);
    },
  };
  const context = vm.createContext(environment);
  new vm.Script(fs.readFileSync(result.worker, 'utf8')).runInContext(context);
  let ready: Promise<any> = Promise.resolve();
  listeners.install({ waitUntil(promise: Promise<any>) { ready = promise; } });
  await ready;
  const request = async (route: string, options?: any): Promise<Response> => {
    let response: Promise<Response> | undefined;
    listeners.fetch({ request: new Request('https://example.test' + route, options),
      respondWith(value: Promise<Response>) { response = value; } });
    assert.ok(response, 'Application request must be handled by the worker');
    return response;
  };
  const configure = async (values: Record<string, string>) => {
    let work: Promise<any> = Promise.resolve();
    listeners.message({ data: { type: 'sesi:environment', values }, ports: [{ postMessage(value: any) {
      assert.equal(value.ok, true);
    } }], waitUntil(value: Promise<any>) { work = value; } });
    await work;
  };
  return { request, configure, files: storage.files };
}

async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-server-build-'));
  try {
    const entry = path.join(folder, 'catalog.sesi');
    fs.writeFileSync(path.join(folder, 'page.html'), '<!doctype html><p>A different Sesi app</p><img src="icon.png">');
    fs.writeFileSync(path.join(folder, 'icon.png'), Buffer.from('a static image'));
    fs.writeFileSync(entry, `
fn handle(req) {
  if req.path == "/" { return {headers: {"Content-Type": "text/html"}, body: read_file("page.html")} }
  if req.path == "/api" {
    let secret = "do-not-bundle-this"
    let headers = {"X-API-Secret": secret, Origin: "https://original.example"}
    let result = web_send("https://provider.test/generate", req.body, headers)
    return {headers: {"Content-Type": "application/json"}, body: from_json(result)}
  }
  if req.path == "/image" { return {headers: {"Content-Type": "image/png"}, body: "UE5H"} }
  return {status: 404, body: "Not found"}
}
let server = listen(3000, handle)
`);
    const build = compileSesiForBrowser(entry, path.join(folder, 'catalog.js'));
    for (const file of [build.javascript, build.worker!]) {
      assert.ok(fs.readFileSync(file, 'utf8').trim().split('\n').length < 10,
        'Page JavaScript and service workers must be minified by default');
    }
    assert.deepEqual(build.credentials, ['SESI_X_API_SECRET']);
    for (const file of [build.javascript, build.worker!, build.launchPage!, build.assets!]) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /do-not-bundle-this/);
    }
    const runtime = await startWorker(build, (async (url: string, options: any) => {
      assert.equal(url, 'https://provider.test/generate');
      assert.equal(options.headers['X-API-Secret'], 'entered-at-runtime');
      assert.equal(options.headers.Origin, undefined);
      return new Response(JSON.stringify({ received: JSON.parse(options.body) }));
    }) as typeof fetch);
    assert.match(await (await runtime.request('/apps/')).text(), /A different Sesi app/);
    assert.equal(await (await runtime.request('/apps/icon.png')).text(), 'a static image');
    await runtime.configure({ SESI_X_API_SECRET: 'entered-at-runtime' });
    const api = await runtime.request('/api', { method: 'POST', body: '{"title":"Cover"}' });
    assert.equal(api.status, 200);
    assert.deepEqual(await api.json(), { received: { title: 'Cover' } });
    const image = await runtime.request('/image');
    assert.equal(image.headers.get('Content-Type'), 'image/png');
    assert.equal(await image.text(), 'PNG');

    // Exercise the user's actual source and all its compiled imports, without a browser or live API call.
    const cover = compileSesiForBrowser('cover_art/server.sesi', path.join(folder, 'cover.js'));
    assert.ok(cover.credentials.includes('SESI_X_API_SECRET'));
    const picture = 'data:image/png;base64,' + Buffer.from('PNG' + 'x'.repeat(80)).toString('base64');
    const app = await startWorker(cover, (async (url: string, options: any) => {
      assert.match(url, /retrorenderer.*gemini/);
      assert.equal(options.headers['X-API-Secret'], 'runtime-only');
      const payload = JSON.parse(options.body);
      assert.equal(payload.action, 'generateImages');
      assert.equal(payload.aspectRatio, '1:1');
      return new Response(JSON.stringify({ imageUrls: [picture] }));
    }) as typeof fetch);
    await app.configure({ SESI_X_API_SECRET: 'runtime-only' });
    assert.match(await (await app.request('/apps/')).text(), /Cover Art Generator/);
    assert.equal((await app.request('/health')).status, 200);
    const profiles: any = await (await app.request('/api/profiles')).json();
    assert.ok(profiles.some((profile: any) => profile.id === 'UNDERGROUND'));
    const art = await app.request('/api/cover-art', { method: 'POST', body: JSON.stringify({
      albumName: 'Demo', artistName: 'Artist', genre: 'Jazz', profile_id: 'UNDERGROUND',
    }) });
    assert.equal(art.status, 200, await art.clone().text());
    const result: any = await art.json();
    assert.equal(result.base64, picture);
    assert.ok(app.files.has('cover_art/covers/Demo_UNDERGROUND.png'));
    const sample = await app.request('/sample/1');
    assert.equal(sample.status, 200);
    assert.equal(sample.headers.get('Content-Type'), 'image/png');
    assert.deepEqual(Buffer.from(await sample.arrayBuffer()), fs.readFileSync('cover_art/covers/INFINITE_UNDERGROUND.png'));
    assert.equal((await app.request('/api/cover-art', { method: 'POST', body: '{}' })).status, 400);
    console.log('Browser server build tests passed');
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
