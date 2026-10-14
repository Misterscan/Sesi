/** Helpers embedded beside directly emitted JavaScript. This code uses browser APIs only. */
export function browserJsRuntime(options: { assetsUrl?: string; workerUrl?: string; baseUrl?: string } = {}): Record<string, any> {
  const truthy = (value: any): boolean => value !== null && value !== undefined && value !== false && value !== 0 && value !== '';
  const stringify = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return '[' + value.map(stringify).join(', ') + ']';
    if (typeof value === 'function') return '<function>';
    if (typeof value === 'object') return '{' + Object.entries(value).map(([key, item]) => key + ': ' + stringify(item)).join(', ') + '}';
    return String(value);
  };
  const add = (left: any, right: any): any => Array.isArray(left) ? left.concat(right)
    : typeof left === 'string' || typeof right === 'string' ? stringify(left) + stringify(right) : left + right;
  const prompt = (parts: any[]): string => parts.map(stringify).join('');
  const object = (entries: Array<[string, any]>): Record<string, any> => {
    const value = Object.create(null);
    for (const [key, item] of entries) value[key] = item;
    return value;
  };
  const equal = (left: any, right: any): boolean => Array.isArray(left) && Array.isArray(right)
    ? left.length === right.length && left.every((value, index) => equal(value, right[index])) : left === right;
  const compare = (left: any, right: any): number => typeof left === 'number' && typeof right === 'number'
    ? left - right : typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : 0;
  const safeKey = (key: string | number): void => {
    if (['__proto__', 'prototype', 'constructor', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__'].includes(String(key))) {
      throw new Error('Unsafe property: ' + key);
    }
  };
  const property = (object: any, key: string | number): any => {
    if (object === null || object === undefined) return null;
    safeKey(key);
    const value = object[key];
    return typeof value === 'function' ? value.bind(object) : value ?? null;
  };
  const setProperty = (object: any, key: string | number, value: any): any => {
    safeKey(key);
    if (object !== null && (typeof object === 'object' || typeof object === 'function')) object[key] = value;
    return value;
  };
  const call = async (callee: any, args: any[]): Promise<any> => {
    if (typeof callee !== 'function') throw new Error('Not a function: ' + stringify(callee));
    return await callee(...args) ?? null;
  };
  const stripPrototypes = (value: any): any => {
    if (Array.isArray(value)) return value.map(stripPrototypes);
    if (value && typeof value === 'object') {
      const clean = Object.create(null);
      for (const [key, item] of Object.entries(value)) clean[key] = stripPrototypes(item);
      return clean;
    }
    return value;
  };
  const parts = (filePath: string): string[] => {
    const result: string[] = [];
    for (const part of filePath.replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!result.length) throw new Error('File path escapes browser storage: ' + filePath);
        result.pop();
      } else result.push(part);
    }
    return result;
  };
  const root = async (): Promise<any> => {
    const storage = (globalThis as any).navigator?.storage;
    if (!storage?.getDirectory) throw new Error('Browser file storage is unavailable');
    return storage.getDirectory();
  };
  const directory = async (pathParts: string[], create = false): Promise<any> => {
    let handle = await root();
    for (const part of pathParts) handle = await handle.getDirectoryHandle(part, { create });
    return handle;
  };
  const fileHandle = async (filePath: string, create = false): Promise<any> => {
    const pathParts = parts(filePath);
    const name = pathParts.pop();
    if (!name) throw new Error('Expected a file path');
    return (await directory(pathParts, create)).getFileHandle(name, { create });
  };
  const storedFile = async (filePath: string): Promise<any> => {
    try { return await (await fileHandle(filePath)).getFile(); }
    catch (error: any) { if (error?.name === 'NotFoundError') return null; throw error; }
  };
  const writeFile = async (filePath: string, content: string | Uint8Array, append = false): Promise<boolean> => {
    const handle = await fileHandle(filePath, true);
    const stream = await handle.createWritable({ keepExistingData: append });
    try {
      if (append) await stream.seek((await handle.getFile()).size);
      await stream.write(content);
    } finally { await stream.close(); }
    return true;
  };
  const fromBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const toBase64 = (value: Uint8Array): string => {
    let text = '';
    for (let index = 0; index < value.length; index += 8192) text += String.fromCharCode(...value.subarray(index, index + 8192));
    return btoa(text);
  };
  let assetPromise: Promise<Record<string, { type: string; data: string }>> | undefined;
  const bundledFile = async (filePath: string): Promise<any> => {
    if (options.assetsUrl) {
      assetPromise ??= (async () => {
        const response = await fetch(new URL(options.assetsUrl!, options.baseUrl).href);
        if (!response.ok) throw new Error('Bundled assets unavailable (' + response.status + ')');
        return await response.json() as Record<string, { type: string; data: string }>;
      })();
      const asset = (await assetPromise)[filePath.replace(/\\/g, '/').replace(/^\.\//, '')];
      if (asset) return new Blob([fromBase64(asset.data) as any], { type: asset.type });
    }
    return null;
  };
  const deployedFile = async (filePath: string): Promise<any> => {
    const asset = await bundledFile(filePath);
    if (asset) return asset;
    const target = options.baseUrl ? new URL(filePath, options.baseUrl).href : filePath;
    const response = await fetch(target);
    if (!response.ok) throw new Error('Failed to read file: ' + filePath + ' (' + response.status + ')');
    return response.blob();
  };

  const builtins: Record<string, (...args: any[]) => any> = Object.create(null);
  builtins.show = (...values: any[]) => { console.log(values.map(stringify).join(' ')); return null; };
  builtins.str = stringify;
  const number = (value: any): number | null => {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') { const result = parseFloat(value); return Number.isNaN(result) ? null : result; }
    return null;
  };
  builtins.num = number; builtins.float = number; builtins.bool = truthy;
  builtins.type = (value: any) => value === null ? 'null' : Array.isArray(value) ? 'array'
    : typeof value === 'boolean' ? 'bool' : typeof value === 'function' ? 'function' : typeof value;
  builtins.len = (value: any) => typeof value === 'string' || Array.isArray(value) ? value.length
    : value && typeof value === 'object' ? Object.keys(value).length : null;
  builtins.to_json = (value: any) => { try { return JSON.stringify(value, null, 2); } catch { return null; } };
  builtins.from_json = (value: any) => { if (typeof value !== 'string') return null; try { return stripPrototypes(JSON.parse(value)); } catch { return null; } };
  builtins.range = (count: any) => typeof count === 'number' ? Array.from({ length: Math.max(0, Math.ceil(count)) }, (_, index) => index) : null;
  builtins.push = (array: any, value: any) => { if (!Array.isArray(array)) return null; array.push(value); return array; };
  builtins.append = (value: any, item: any) => Array.isArray(value) ? (value.push(item), value)
    : typeof value === 'string' ? value + stringify(item) : null;
  builtins.pop = (array: any) => Array.isArray(array) ? array.pop() ?? null : null;
  builtins.keys = (value: any) => value && typeof value === 'object' ? Object.keys(value) : null;
  builtins.values = (value: any) => value && typeof value === 'object' ? Object.values(value) : null;
  builtins.join = (array: any, separator: any) => Array.isArray(array) && typeof separator === 'string' ? array.map(stringify).join(separator) : null;
  builtins.split = (value: any, separator: any) => typeof value === 'string' && typeof separator === 'string' ? value.split(separator) : null;
  builtins.to_upper = (value: any) => typeof value === 'string' ? value.toUpperCase() : null;
  builtins.to_lower = (value: any) => typeof value === 'string' ? value.toLowerCase() : null;
  builtins.trim = (value: any) => typeof value === 'string' ? value.trim() : null;
  builtins.slice = (value: any, start: any, end: any) => value?.slice?.(start, end) ?? null;
  builtins.contains = (value: any, part: any) => value?.includes?.(part) ?? false;
  builtins.is_string = (value: any) => typeof value === 'string';
  builtins.is_number = (value: any) => typeof value === 'number';
  builtins.is_bool = (value: any) => typeof value === 'boolean';
  builtins.is_array = Array.isArray;
  builtins.is_object = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);
  builtins.is_null = (value: any) => value === null;
  builtins.is_function = (value: any) => typeof value === 'function';
  builtins.error_type = (type: string, message = '', data: any = null) => ({ type, message, data });
  builtins.raise_error = (type: any, message = '', data: any = null) => {
    const details = typeof type === 'object' ? type : { type, message, data };
    throw Object.assign(new Error(details.message), { type: details.type, data: details.data });
  };
  builtins.regex = (pattern: string, text: string, settings: any = null) => {
    if (typeof pattern !== 'string' || typeof text !== 'string') throw new Error('regex expects pattern and text strings');
    const expression = new RegExp(pattern, typeof settings === 'string' ? settings : settings?.flags ?? '');
    const mode = settings?.mode ?? 'match';
    if (mode === 'test') return expression.test(text);
    if (mode === 'replace') return text.replace(expression, settings.replacement);
    if (mode === 'split') return text.split(expression);
    return text.match(expression) ? [...text.match(expression)!] : null;
  };
  for (const key of ['floor', 'ceil', 'abs', 'sin', 'cos', 'tan', 'sqrt', 'pow', 'log']) builtins[key] = (Math as any)[key].bind(Math);
  builtins.random = Math.random; builtins.now = Date.now; builtins.time = Date.now;
  builtins.sleep = (milliseconds: any) => new Promise(resolve => setTimeout(resolve, typeof milliseconds === 'number' ? milliseconds : 0));
  builtins.map = async (array: any[], callback: Function) => {
    if (!Array.isArray(array)) throw new Error('map expects an array');
    const result = [];
    for (let index = 0; index < array.length; index++) result.push(await callback(array[index], index, array));
    return result;
  };
  builtins.filter = async (array: any[], callback: Function) => {
    if (!Array.isArray(array)) throw new Error('filter expects an array');
    const result = [];
    for (let index = 0; index < array.length; index++) if (truthy(await callback(array[index], index, array))) result.push(array[index]);
    return result;
  };
  builtins.reduce = async (array: any[], callback: Function, initial?: any) => {
    if (!Array.isArray(array)) throw new Error('reduce expects an array');
    let index = 0, value = initial;
    if (initial === undefined) { if (!array.length) throw new Error('reduce of empty array'); value = array[0]; index = 1; }
    for (; index < array.length; index++) value = await callback(value, array[index], index, array);
    return value;
  };
  builtins.find = async (array: any[], callback: Function) => {
    if (!Array.isArray(array)) throw new Error('find expects an array');
    for (let index = 0; index < array.length; index++) if (truthy(await callback(array[index], index, array))) return array[index];
    return null;
  };
  builtins.html = (body: any = '', options: any = null) => {
    const settings = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const title = typeof settings.title === 'string' ? settings.title : 'Sesi';
    const head = typeof settings.head === 'string' ? settings.head : '';
    const lang = typeof settings.lang === 'string' ? settings.lang : 'en';
    const tags = ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">',
      title ? '<title>' + escape(title) + '</title>' : '', head].filter(Boolean).join('\n  ');
    return '<!DOCTYPE html>\n<html lang="' + escape(lang) + '">\n<head>\n  ' + tags
      + '\n</head>\n<body>\n' + (typeof body === 'string' ? body : stringify(body)) + '\n</body>\n</html>';
  };
  builtins.make_dir = async (filePath: any) => { if (typeof filePath !== 'string') return null; await directory(parts(filePath), true); return true; };
  builtins.write_file = (filePath: any, content: any, encoding?: any) => typeof filePath === 'string' && typeof content === 'string'
    ? writeFile(filePath, encoding === 'base64' ? fromBase64(content) : content) : null;
  builtins.append_file = (filePath: any, content: any) => typeof filePath === 'string' && typeof content === 'string'
    ? writeFile(filePath, content, true) : null;
  builtins.write_image = (filePath: any, content: any) => typeof filePath === 'string' && typeof content === 'string'
    ? writeFile(filePath, fromBase64(content)) : null;
  builtins.read_file = async (pathOrOptions: any, mode: any = 'text') => {
    const filePath = pathOrOptions && typeof pathOrOptions === 'object'
      ? pathOrOptions.path ?? pathOrOptions.filePath ?? pathOrOptions.filepath : pathOrOptions;
    const readMode = String(pathOrOptions?.mode ?? mode).toLowerCase();
    if (typeof filePath !== 'string' || !['text', 'base64'].includes(readMode)) return null;
    let file: any = null;
    try { file = await storedFile(filePath); }
    catch (error: any) { if (error?.message !== 'Browser file storage is unavailable') throw error; }
    if (!file) file = await deployedFile(filePath);
    return readMode === 'base64' ? toBase64(new Uint8Array(await file.arrayBuffer())) : file.text();
  };
  builtins.list_dir = async (filePath: any) => {
    if (typeof filePath !== 'string') return null;
    try {
      const handle = await directory(parts(filePath));
      const result: string[] = [];
      for await (const [name] of handle.entries()) if (!name.startsWith('.')) result.push(name);
      return result.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } catch (error: any) { if (error?.name === 'NotFoundError') return null; throw error; }
  };
  builtins.exists = async (filePath: any) => {
    if (typeof filePath !== 'string') return false;
    const pathParts = parts(filePath);
    if (!pathParts.length) return true;
    const name = pathParts.pop()!;
    try {
      const parent = await directory(pathParts);
      try { await parent.getFileHandle(name); return true; } catch (error: any) { if (error?.name !== 'NotFoundError') throw error; }
      try { await parent.getDirectoryHandle(name); return true; } catch (error: any) { if (error?.name !== 'NotFoundError') throw error; }
    } catch (error: any) { if (error?.name !== 'NotFoundError' && error?.message !== 'Browser file storage is unavailable') throw error; }
    try { return (await fetch(filePath, { method: 'HEAD' })).ok; } catch { return false; }
  };
  builtins.get_ext = (filePath: any) => {
    if (typeof filePath !== 'string') return null;
    const name = filePath.replace(/\\/g, '/').split('/').pop()!.toLowerCase();
    for (const extension of ['tar.gz', 'tar.bz2', 'tar.xz']) if (name.endsWith('.' + extension)) return extension;
    return name.startsWith('.') && name.indexOf('.', 1) === -1 ? '' : name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  };
  builtins.open_file = async (filePath: any) => {
    if (typeof filePath !== 'string') throw new Error('open_file expects a string path');
    const opened = (globalThis as any).open?.('', '_blank');
    if (!opened) throw new Error('Browser blocked opening file: ' + filePath);
    try {
      const file = await storedFile(filePath);
      if (!file) throw new Error('File does not exist: ' + filePath);
      const extension = builtins.get_ext(filePath);
      const mime: Record<string, string> = { html: 'text/html', htm: 'text/html', txt: 'text/plain', md: 'text/markdown',
        json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
      const url = URL.createObjectURL(new Blob([file], { type: mime[extension] ?? 'application/octet-stream' }));
      opened.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch (error) { opened.close?.(); throw error; }
  };
  builtins.open = async (target: any) => {
    if (typeof target !== 'string') throw new Error('open expects a string target');
    if (!/^https?:\/\//i.test(target)) return builtins.open_file(target);
    if (!(globalThis as any).open?.(target, '_blank')) throw new Error('Browser blocked opening URL: ' + target);
    return true;
  };
  const requestHeaders = (headers: any): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers && typeof headers === 'object' ? headers : {})) {
      if (/^(authorization|x-api-secret|x-api-key|api-key|x-goog-api-key)$/i.test(key) && !value) {
        throw new Error('Missing runtime credential for ' + key);
      }
      // Fetch supplies these headers from the real browser origin.
      if (/^(origin|host|content-length|cookie|connection)$|^(sec-|proxy-)/i.test(key)) continue;
      result[key] = String(value);
    }
    return result;
  };
  builtins.web_get = async (url: any, headers: any = {}) => {
    const values = requestHeaders(headers);
    try { return await (await fetch(typeof url === 'string' ? url : '', { method: 'GET', headers: values })).text(); }
    catch (error: any) { throw new Error('web_get failed: ' + error.message); }
  };
  builtins.web_send = async (url: any, body: any, headers: any = {}) => {
    const values = { 'Content-Type': 'application/json', ...requestHeaders(headers) };
    try { return await (await fetch(typeof url === 'string' ? url : '', {
      method: 'POST', headers: values, body: typeof body === 'string' ? body : JSON.stringify(body),
    })).text(); }
    catch (error: any) { throw new Error('web_send failed: ' + error.message); }
  };
  builtins.listen = async (port: any, handler: any) => {
    if (typeof port !== 'number' || typeof handler !== 'function') throw new Error('listen expects a port and request handler');
    const scope = globalThis as any;
    if (typeof scope.__sesiBrowserListen === 'function') {
      scope.__sesiBrowserListen(async (request: any) => {
        const url = new URL(request.url), prefix = new URL(scope.registration.scope).pathname;
        const route = url.pathname.startsWith(prefix) ? '/' + url.pathname.slice(prefix.length) : url.pathname;
        const result = await handler({ method: request.method, path: route,
          headers: Object.fromEntries(request.headers.entries()), query: Object.fromEntries(url.searchParams.entries()),
          body: request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text() });
        let status = 200, headers: Record<string, string> = { 'Content-Type': 'text/plain' }, body: any = result ?? '';
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          status = typeof result.status === 'number' ? result.status : 200;
          headers = { 'Content-Type': 'text/html', ...result.headers };
          body = result.body ?? (result.status === undefined && result.headers === undefined ? result : '');
          if (body !== null && typeof body === 'object') {
            body = JSON.stringify(body);
            if (headers['Content-Type'] === 'text/html') headers['Content-Type'] = 'application/json';
          } else {
            const contentType = String(headers['Content-Type'] ?? headers['content-type'] ?? '').toLowerCase();
            body = /^(image\/(?!svg\+xml)|audio\/|video\/|application\/octet-stream)/.test(contentType)
              ? fromBase64(String(body)) : String(body);
          }
        }
        if (status === 404) {
          const asset = await bundledFile(route.replace(/^\//, ''));
          if (asset) return new Response(request.method === 'HEAD' ? null : asset, { headers: { 'Content-Type': asset.type } });
        }
        return new Response(request.method === 'HEAD' || [204, 205, 304].includes(status) ? null : body, { status, headers });
      });
      return { port, close: () => scope.__sesiBrowserListen(undefined) };
    }
    if (!options.workerUrl || !scope.navigator?.serviceWorker) {
      throw new Error('Browser request handlers require the generated launch page on HTTPS or localhost');
    }
    const workerUrl = new URL(options.workerUrl, options.baseUrl).href;
    const registration = await scope.navigator.serviceWorker.register(workerUrl, { scope: './', updateViaCache: 'none' });
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (worker.state !== 'activated') await new Promise<void>((resolve, reject) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
        if (worker.state === 'redundant') reject(new Error('Sesi request handler failed to start'));
      });
    });
    if (!scope.navigator.serviceWorker.controller) await new Promise<void>(resolve =>
      scope.navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    const environment = scope.SESI_ENV ?? {};
    if (Object.keys(environment).length) await new Promise<void>((resolve, reject) => {
      const channel = new scope.MessageChannel();
      channel.port1.onmessage = (event: any) => {
        channel.port1.close();
        if (event.data.error) reject(new Error(event.data.error)); else resolve();
      };
      worker.postMessage({ type: 'sesi:environment', values: environment }, [channel.port2]);
    });
    scope.location.replace(new URL('./', workerUrl).href);
    return { port, close: () => registration.unregister() };
  };
  const builtin = async (name: string, args: any[]): Promise<any> => {
    const operation = builtins[name];
    if (!operation) throw new Error('Browser built-in unavailable: ' + name);
    return await operation(...args) ?? null;
  };
  const global = (name: string): any => {
    if (name === 'args') return [];
    if (builtins[name]) return builtins[name];
    if (name in globalThis) return property(globalThis, name);
    throw new Error('Undefined variable: ' + name);
  };
  const standard = (name: string): Record<string, any> => {
    if (name === 'std/math') return Object.fromEntries(Object.getOwnPropertyNames(Math).map(key => [key, property(Math, key)]));
    if (name === 'std/time') return { now: Date.now, sleep: builtins.sleep };
    throw new Error('Module unavailable in browser: ' + name);
  };
  const memory = new Map<string, string>();
  const memorySettings = new Map<string, { enabled: boolean; maxTokens: number; targetTokens: number; summaryModel: string }>();
  const browserValue = (name: string): string | null => {
    const configured = (globalThis as any).SESI_ENV?.[name];
    if (typeof configured === 'string') return configured;
    const direct = (globalThis as any)[name];
    if (typeof direct === 'string') return direct;
    try { return (globalThis as any).localStorage?.getItem(name) ?? null; }
    catch { return null; }
  };
  builtins.env = (name: string, fallback: any = null) => browserValue(name) ?? fallback;
  const pick = (settings: any, ...keys: string[]): any => {
    for (const key of keys) if (settings && Object.prototype.hasOwnProperty.call(settings, key)) return settings[key];
    return undefined;
  };
  const apiKey = (name: string): string => {
    const key = browserValue(name);
    if (!key) throw new Error(name + ' is not set in browser runtime');
    return key;
  };
  const memoryConfig = (name: string): { enabled: boolean; maxTokens: number; targetTokens: number; summaryModel: string } => {
    const maxTokens = Number(browserValue('SESI_MEMORY_MAX_TOKENS') ?? 900000);
    return memorySettings.get(name) ?? { enabled: browserValue('SESI_MEMORY_AUTO_SUMMARIZE') !== 'false',
      maxTokens, targetTokens: Number(browserValue('SESI_MEMORY_TARGET_TOKENS') ?? Math.floor(maxTokens * 0.6)),
      summaryModel: browserValue('SESI_MEMORY_SUMMARY_MODEL') ?? 'gemini-3.5-flash-lite' };
  };
  const jsonRequest = async (url: string, key: string, body?: any, method = 'POST'): Promise<any> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (url.startsWith('https://api.openai.com/')) headers.Authorization = 'Bearer ' + key;
    else headers['x-goog-api-key'] = key;
    const response = await fetch(url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error('AI request failed (' + response.status + '): ' + (await response.text()));
    return response.json();
  };
  const mediaInput = async (input: string): Promise<{ mimeType: string; data: string }> => {
    let file: any = null;
    try { file = await storedFile(input); } catch (error: any) {
      if (error?.message !== 'Browser file storage is unavailable') throw error;
    }
    if (!file) {
      const response = await fetch(input);
      if (!response.ok) throw new Error('Media file unavailable: ' + input);
      file = await response.blob();
    }
    const extension = input.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
      m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac', webm: 'audio/webm',
      mpeg: 'audio/mpeg', mpga: 'audio/mpeg', mp4: 'video/mp4' };
    return { mimeType: file.type || mimeTypes[extension ?? ''] || 'application/octet-stream',
      data: toBase64(new Uint8Array(await file.arrayBuffer())) };
  };
  builtins.from_speech = async (input: any, language: any = null, model: any = null) => {
    if (typeof input !== 'string' || !input.trim()) throw new Error('from_speech() expects an audio file path');
    if (language !== null && typeof language !== 'string') throw new Error('from_speech() language must be a string or null');
    if (model !== null && (typeof model !== 'string' || !model.trim())) {
      throw new Error('from_speech() model must be a non-empty string or null');
    }
    const selectedModel = (model ?? 'gpt-transcribe').trim().replace(/^models\//, '');
    const isOpenAI = /^gpt-/i.test(selectedModel);
    if (!isOpenAI && !/^gemini-/i.test(selectedModel)) {
      throw new Error('from_speech() expects an OpenAI transcription model or Gemini model.');
    }
    const key = apiKey(isOpenAI ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY');
    const audio = await mediaInput(input);
    if (isOpenAI) {
      const form = new (globalThis as any).FormData();
      const filename = input.split(/[?#]/)[0].replace(/\\/g, '/').split('/').pop();
      form.append('file', new Blob([new Uint8Array(fromBase64(audio.data))], { type: audio.mimeType }), filename);
      form.append('model', selectedModel);
      form.append('response_format', 'json');
      if (language?.trim()) form.append('language', language.trim());
      if (/diarize/i.test(selectedModel)) form.append('chunking_strategy', 'auto');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: form,
      });
      if (!response.ok) throw new Error('Speech transcription failed (' + response.status + '): ' + await response.text());
      const result = await response.json() as { text?: unknown } | null;
      if (typeof result?.text !== 'string') throw new Error('Speech transcription returned no transcript text.');
      return result.text;
    }
    const instruction = 'Transcribe this audio accurately. Return only the transcript, without commentary, timestamps, or labels.'
      + (language?.trim() ? ' The spoken language is ' + language.trim() + '; preserve it in the transcript.' : '');
    const result = await jsonRequest('https://generativelanguage.googleapis.com/v1beta/models/'
      + encodeURIComponent(selectedModel) + ':generateContent', key, {
        contents: [{ role: 'user', parts: [{ text: instruction }, { inlineData: audio }] }],
      });
    const parts = result.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) throw new Error('Speech transcription returned no transcript text.');
    return parts.filter((part: any) => typeof part.text === 'string').map((part: any) => part.text).join('');
  };
  const mediaPaths = (settings: any, separate: any): string[] => {
    const raw = separate ?? pick(settings, 'images', 'image', 'imgs', 'imgRefs', 'img_refs');
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);
  };
  const aiCall = async (operation: string, modelValue: any, promptValue: any, config: any, images: any): Promise<any> => {
    const model = String(modelValue ?? '').replace(/^models\//, '').trim();
    if (!model) throw new Error(operation + ' expects a model name');
    const promptText = stringify(promptValue);
    const settings = config && typeof config === 'object' ? config : {};
    const paths = mediaPaths(settings, images);
    const isOpenAI = /^gpt-/i.test(model);
    const key = apiKey(isOpenAI ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY');
    const imageGeneration = operation === 'image' || (operation === 'model' && model.includes('image'));
    if (operation === 'video') {
      if (isOpenAI) throw new Error('Video model is not supported by the Sesi browser runtime: ' + model);
      const base = 'https://generativelanguage.googleapis.com/v1beta/';
      if (/omni/i.test(model)) {
        const input: any[] = [];
        for (const path of paths) { const image = await mediaInput(path);
          input.push({ type: 'image', data: image.data, mime_type: image.mimeType }); }
        input.push({ type: 'text', text: promptText });
        const responseFormat: Record<string, any> = { type: 'video' };
        const ratio = pick(settings, 'ratio', 'aspectRatio', 'aspect_ratio');
        const resolution = pick(settings, 'resolution', 'size');
        if (ratio) responseFormat.aspect_ratio = ratio;
        if (resolution) responseFormat.resolution = resolution;
        const body: Record<string, any> = { model, input: paths.length ? input : promptText,
          response_format: responseFormat };
        const task = pick(settings, 'task');
        if (task) body.generation_config = { video_config: { task } };
        const result = await jsonRequest(base + 'interactions', key, body);
        const video = result.steps?.filter((step: any) => step.type === 'model_output')
          .flatMap((step: any) => step.content ?? []).find((part: any) => part.type === 'video');
        if (video?.data) return video.data;
        throw new Error('Video generation returned no video');
      }
      const instance: Record<string, any> = { prompt: promptText };
      if (paths.length) { const input = await mediaInput(paths[0]); instance.image = { inlineData: input }; }
      const parameters: Record<string, any> = {};
      for (const [field, keys] of Object.entries({ aspectRatio: ['ratio', 'aspectRatio', 'aspect_ratio'],
        durationSeconds: ['duration', 'durationSeconds', 'duration_seconds'], resolution: ['resolution', 'size'],
        negativePrompt: ['negative_prompt', 'negativePrompt'], generateAudio: ['audio', 'generateAudio', 'generate_audio'] })) {
        const value = pick(settings, ...keys); if (value !== undefined) parameters[field] = value;
      }
      let result = await jsonRequest(base + 'models/' + encodeURIComponent(model) + ':predictLongRunning', key,
        { instances: [instance], parameters });
      const poll = Math.max(100, Number(pick(settings, 'poll_interval', 'pollInterval') ?? 10000));
      while (!result.done) {
        if (!result.name) throw new Error('Video generation returned no operation name');
        await new Promise(resolve => setTimeout(resolve, poll));
        result = await jsonRequest(base + result.name, key, undefined, 'GET');
      }
      if (result.error) throw new Error('Video generation failed: ' + JSON.stringify(result.error));
      const video = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video
        ?? result.response?.generatedVideos?.[0]?.video;
      if (typeof video?.videoBytes === 'string') return video.videoBytes;
      if (typeof video?.data === 'string') return video.data;
      if (!video?.uri) throw new Error('Video generation returned no video');
      const response = await fetch(video.uri, { headers: { 'x-goog-api-key': key } });
      if (!response.ok) throw new Error('Video download failed (' + response.status + ')');
      return toBase64(new Uint8Array(await response.arrayBuffer()));
    }
    if (isOpenAI && imageGeneration) {
      const size = pick(settings, 'size', 'imgSize', 'imageSize');
      const body = new FormData();
      body.set('model', model); body.set('prompt', promptText);
      if (size) body.set('size', String(size));
      let endpoint = 'https://api.openai.com/v1/images/generations';
      if (paths.length) {
        endpoint = 'https://api.openai.com/v1/images/edits';
        for (const path of paths) {
          const input = await mediaInput(path);
          body.append('image[]', new Blob([fromBase64(input.data) as any], { type: input.mimeType }), path.split('/').pop() || 'image.png');
        }
      }
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body });
      if (!response.ok) throw new Error('Image request failed (' + response.status + '): ' + await response.text());
      const result: any = await response.json();
      const image = result.data?.[0];
      if (image?.b64_json) return image.b64_json;
      if (image?.url) { const file = await fetch(image.url); if (!file.ok) throw new Error('Image download failed');
        return toBase64(new Uint8Array(await file.arrayBuffer())); }
      throw new Error('Image generation returned no image');
    }
    if (isOpenAI) {
      const content: any[] = [];
      for (const path of paths) { const input = await mediaInput(path);
        content.push({ type: 'input_image', image_url: 'data:' + input.mimeType + ';base64,' + input.data }); }
      content.push({ type: 'input_text', text: promptText });
      const body: Record<string, any> = { model, input: paths.length ? [{ role: 'user', content }] : promptText };
      const system = pick(settings, 'system', 'system_prompt', 'systemPrompt');
      if (system) body.instructions = String(system);
      const maxTokens = pick(settings, 'max_tokens', 'maxTokens', 'maxT');
      if (maxTokens !== undefined) body.max_output_tokens = maxTokens;
      const temperature = pick(settings, 'temperature', 'temp'); if (temperature !== undefined) body.temperature = temperature;
      const topP = pick(settings, 'top_p', 'topP'); if (topP !== undefined) body.top_p = topP;
      if (pick(settings, 'search', 'grounding')) body.tools = [{ type: 'web_search' }];
      const result = await jsonRequest('https://api.openai.com/v1/responses', key, body);
      const answer = result.output_text ?? result.output?.flatMap((item: any) => item.content ?? [])
        .filter((item: any) => item.type === 'output_text').map((item: any) => item.text).join('') ?? '';
      return pick(settings, 'response') === 'full' ? { text: answer, model,
        finish_reason: result.status ?? null, cached: false, input_tokens: result.usage?.input_tokens ?? 0,
        output_tokens: result.usage?.output_tokens ?? 0, thinking_tokens: 0,
        billable_output_tokens: result.usage?.output_tokens ?? 0,
        total_tokens: result.usage?.total_tokens ?? 0 } : answer;
    }
    const parts: any[] = [];
    for (const path of paths) { const input = await mediaInput(path); parts.push({ inlineData: input }); }
    parts.push({ text: promptText });
    const generationConfig: Record<string, any> = {};
    for (const [field, keys] of Object.entries({ temperature: ['temperature', 'temp'],
      maxOutputTokens: ['max_tokens', 'maxTokens', 'maxT'], topK: ['top_k', 'topK'], topP: ['top_p', 'topP'] })) {
      const value = pick(settings, ...keys); if (value !== undefined) generationConfig[field] = value;
    }
    if (imageGeneration) {
      generationConfig.responseModalities = ['IMAGE'];
      const aspectRatio = pick(settings, 'ratio', 'imgRatio', 'imageRatio', 'aspectRatio');
      const imageSize = pick(settings, 'size', 'imgSize', 'imageSize');
      if (aspectRatio || imageSize) generationConfig.imageConfig = { ...(aspectRatio ? { aspectRatio } : {}),
        ...(imageSize ? { imageSize } : {}) };
    }
    const body: Record<string, any> = { contents: [{ role: 'user', parts }] };
    if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;
    const system = pick(settings, 'system', 'system_prompt', 'systemPrompt');
    if (system) body.systemInstruction = { parts: [{ text: String(system) }] };
    if (pick(settings, 'search', 'grounding')) body.tools = [{ googleSearch: {} }];
    const result = await jsonRequest('https://generativelanguage.googleapis.com/v1beta/models/'
      + encodeURIComponent(model) + ':generateContent', key, body);
    const responseParts = result.candidates?.[0]?.content?.parts ?? [];
    const answer = imageGeneration ? responseParts.find((part: any) => part.inlineData?.data)?.inlineData.data
      : responseParts.filter((part: any) => typeof part.text === 'string' && !part.thought).map((part: any) => part.text).join('');
    if (!answer) throw new Error('Model returned no ' + (imageGeneration ? 'image' : 'text'));
    return pick(settings, 'response') === 'full' ? { text: answer, model,
      finish_reason: result.candidates?.[0]?.finishReason ?? null, cached: false,
      input_tokens: result.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: result.usageMetadata?.candidatesTokenCount ?? 0,
      thinking_tokens: result.usageMetadata?.thoughtsTokenCount ?? 0,
      billable_output_tokens: (result.usageMetadata?.candidatesTokenCount ?? 0) + (result.usageMetadata?.thoughtsTokenCount ?? 0),
      total_tokens: result.usageMetadata?.totalTokenCount ?? 0 } : answer;
  };
  const trimMemory = async (name: string, limit?: number): Promise<string> => {
    const value = memory.get(name) ?? '';
    const config = memoryConfig(name);
    const maxTokens = limit ?? config.maxTokens;
    if (Math.ceil(value.length / 4) <= maxTokens) return value;
    const tailLength = Math.min(value.length, Math.max(4, Math.floor(config.targetTokens * 2)));
    const older = value.slice(0, -tailLength), recent = value.slice(-tailLength);
    try {
      const summary = await aiCall('model', config.summaryModel,
        'Summarize this conversation history, preserving decisions and important facts:\n' + older, null, null);
      const compacted = '[Memory Summary]\n' + summary + '\n' + recent;
      memory.set(name, compacted);
      try { (globalThis as any).localStorage?.setItem('sesi:memory:' + name, compacted); } catch {}
      return compacted;
    } catch { return value; }
  };
  builtins.memory_config = (name: any, options: any = {}) => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('memory_config expects a non-empty memory name');
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('memory_config expects an options object');
    const current = memoryConfig(name);
    const maxTokens = pick(options, 'max_tokens', 'maxTokens') ?? current.maxTokens;
    const targetTokens = pick(options, 'target_tokens', 'targetTokens') ?? current.targetTokens;
    const summaryModel = pick(options, 'summary_model', 'summaryModel') ?? current.summaryModel;
    const enabled = pick(options, 'enabled') ?? current.enabled;
    if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0
      || typeof targetTokens !== 'number' || !Number.isFinite(targetTokens) || targetTokens <= 0
      || typeof summaryModel !== 'string' || !summaryModel.trim() || typeof enabled !== 'boolean') {
      throw new Error('Invalid memory_config options');
    }
    const config = { enabled, maxTokens, targetTokens: Math.min(maxTokens, targetTokens), summaryModel };
    memorySettings.set(name, config);
    return { enabled, max_tokens: maxTokens, target_tokens: config.targetTokens, summary_model: summaryModel };
  };
  builtins.memory_trim = async (name: any, maxTokens: any = 900000) => {
    if (typeof name !== 'string') throw new Error('memory_trim expects a string memory name');
    return trimMemory(name, typeof maxTokens === 'number' ? maxTokens : 900000);
  };
  builtins.memory_search = async (name: any, query: any, topK: any = 3) => {
    if (typeof name !== 'string' || typeof query !== 'string') throw new Error('memory_search expects a name and query strings');
    const value = memory.get(name);
    if (!value?.trim()) return [];
    const key = apiKey('GEMINI_API_KEY');
    const embed = async (text: string): Promise<number[]> => {
      const result = await jsonRequest('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
        key, { content: { parts: [{ text }] } });
      return result.embedding?.values ?? [];
    };
    const [a, b] = await Promise.all([embed(query), embed(value)]);
    if (!a.length || a.length !== b.length) throw new Error('Memory embedding returned no valid vector');
    const dot = a.reduce((sum: number, item: number, index: number) => sum + item * b[index], 0);
    const left = Math.hypot(...a), right = Math.hypot(...b);
    return Number(topK) > 0 ? [{ text: value, score: Math.round((left && right ? dot / (left * right) : 0) * 10000) / 10000 }] : [];
  };
  const convertMedia = async (kind: string, inputValue: any, config: any): Promise<string> => {
    const input = stringify(inputValue);
    const outputType = String(pick(config, 'output_type') ?? '').toLowerCase();
    if (kind !== 'media' || !['png', 'jpg', 'jpeg', 'webp'].includes(outputType)) {
      throw new Error('Browser conversion does not support ' + kind + ' to ' + outputType);
    }
    const source = input.trim().startsWith('<svg') ? new Blob([input], { type: 'image/svg+xml' }) : null;
    let imageFile: Blob;
    if (source) imageFile = source;
    else {
      let file: any = null;
      try { file = await storedFile(input); } catch (error: any) {
        if (error?.message !== 'Browser file storage is unavailable') throw error;
      }
      if (!file) { const response = await fetch(input); if (!response.ok) throw new Error('Media file unavailable: ' + input);
        file = await response.blob(); }
      imageFile = file;
    }
    const bitmap = await (globalThis as any).createImageBitmap(imageFile);
    try {
      const canvas: any = typeof (globalThis as any).OffscreenCanvas !== 'undefined'
        ? new (globalThis as any).OffscreenCanvas(bitmap.width, bitmap.height)
        : (globalThis as any).document?.createElement('canvas');
      if (!canvas) throw new Error('Browser canvas is unavailable');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const mime = outputType === 'jpg' ? 'image/jpeg' : 'image/' + outputType;
      const converted: Blob = canvas.convertToBlob ? await canvas.convertToBlob({ type: mime })
        : await new Promise((resolve, reject) => canvas.toBlob((blob: Blob | null) => blob ? resolve(blob)
          : reject(new Error('Image conversion failed')), mime));
      if (converted.type !== mime) throw new Error('Browser cannot encode ' + mime);
      const name = source ? 'output_' + Date.now() + '.' + outputType
        : input.replace(/\.[^./]+$/, '') + '.' + outputType;
      await writeFile(name, new Uint8Array(await converted.arrayBuffer()));
      return name;
    } finally { bitmap.close?.(); }
  };
  const host = async (operation: string, args: any[] = []): Promise<any> => {
    if (operation === 'env') return browserValue(String(args[0]));
    if (operation === 'memory' || operation === 'memory_update') {
      const name = String(args[0]), value = stringify(args[1]);
      memory.set(name, value);
      try { (globalThis as any).localStorage?.setItem('sesi:memory:' + name, value); } catch {}
      return operation === 'memory_update' && memoryConfig(name).enabled ? trimMemory(name) : value;
    }
    if (operation === 'model' || operation === 'image' || operation === 'video')
      return aiCall(operation, args[0], args[1], args[2], args[3]);
    if (operation === 'convert') return convertMedia(String(args[0]), args[1], args[2]);
    if (operation === 'structured_output') {
      const value = args[0];
      if (typeof value !== 'string') return value;
      const parsed = stripPrototypes(JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/g, '')));
      const schema = args[1] ?? {};
      for (const [key, type] of Object.entries(schema)) {
        const expected = (type as any)?.name === 'bool' ? 'boolean' : (type as any)?.name;
        if (!(key in parsed) || (expected && typeof parsed[key] !== expected)) throw new Error('Structured output field invalid: ' + key);
      }
      return parsed;
    }
    throw new Error('Sesi ' + operation + ' requires a browser implementation');
  };
  const runtimeError = (error: any, line: number): any => ({ type: 'RuntimeError', message: error?.message ?? String(error), line });
  return { truthy, stringify, add, prompt, object, equal, compare, property, setProperty, call, builtin, global, standard, host, runtimeError };
}
