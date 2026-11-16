import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compileSesiForBrowser } from '../src/browser-compiler';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';

async function main(): Promise<void> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-browser-test-'));
  let sequence = 0;
  const originalLog = console.log;
  const capture = async (action: () => Promise<unknown>): Promise<string[]> => {
    const lines: string[] = [];
    console.log = (...values) => { lines.push(values.map(String).join(' ')); };
    try { await action(); return lines; }
    finally { console.log = originalLog; }
  };
  const run = async (source: string, compareInterpreter = true): Promise<string[]> => {
    const input = path.join(directory, `program${++sequence}.sesi`);
    const output = path.join(directory, `program${sequence}.js`);
    fs.writeFileSync(input, source);
    compileSesiForBrowser(input, output);
    const generated = fs.readFileSync(output, 'utf8');
    assert.doesNotMatch(generated, /\$\$sesiBundle|"code":\s*\[/);
    const browserOutput = await capture(async () => {
      await import(`data:text/javascript,${encodeURIComponent(generated)}`);
    });
    if (compareInterpreter) {
      const parser = new Parser(new Lexer(source).scanTokens());
      const program = parser.parse();
      assert.equal(parser.errors.length, 0);
      const interpreterOutput = await capture(async () => {
        await new Interpreter(directory).interpret(program);
      });
      assert.deepEqual(browserOutput, interpreterOutput);
    }
    return browserOutput;
  };
  try {
    assert.deepEqual(await run(`
let base = 100
fn addBase(n) { return n + base }
show addBase(5)
base = 200
show addBase(5)
let names = ["Ada", "Lin"]
for name in names { show "Hello," name }
for i = 0 to 3 { show i }
`), ['105', '205', 'Hello, Ada', 'Hello, Lin', '0', '1', '2']);
    const generated = fs.readFileSync(path.join(directory, 'program1.js'), 'utf8');
    assert.ok(generated.trim().split('\n').length < 10, 'JavaScript output must be minified by default');
    assert.doesNotMatch(generated, /Generated from Sesi source/);

    // A fresh process makes esbuild read the extracted executable path before
    // its API is initialized, matching the standalone executable's behavior.
    const extractedBinary = execFileSync(process.execPath, ['-e', `
      process.pkg = {};
      delete process.env.ESBUILD_BINARY_PATH;
      const fs = require('node:fs');
      const { compileSesiForBrowser } = require(${JSON.stringify(path.join(process.cwd(), 'dist/browser-compiler.js'))});
      compileSesiForBrowser(${JSON.stringify(path.join(directory, 'program1.sesi'))}, ${JSON.stringify(path.join(directory, 'packaged-mode.js'))});
      if (!fs.existsSync(process.env.ESBUILD_BINARY_PATH)) throw new Error('Missing extracted esbuild executable');
      console.log(process.env.ESBUILD_BINARY_PATH);
    `], { encoding: 'utf8' }).trim();
    assert.ok(extractedBinary.includes('sesi-esbuild-'));
    assert.equal(fs.existsSync(extractedBinary), false, 'temporary esbuild executable is removed at exit');
    const packagedOutput = await capture(async () => {
      const code = fs.readFileSync(path.join(directory, 'packaged-mode.js'), 'utf8');
      await import(`data:text/javascript,${encodeURIComponent(code)}`);
    });
    assert.deepEqual(packagedOutput, ['105', '205', 'Hello, Ada', 'Hello, Lin', '0', '1', '2']);

    assert.deepEqual(await run(`
prompt header {"Welcome " "Sesi"}
show header
make Person {
  let kind = "person"
  fn start(self, name) { self.name = name }
  fn greet(self) { return "Hello, " + self.name }
}
let ada = Person("Ada")
show ada.kind
show ada.greet()
`), ['Welcome Sesi', 'person', 'Hello, Ada']);

    fs.writeFileSync(path.join(directory, 'math.sesi'), 'export fn double(x) { return x * 2 }\n');
    assert.deepEqual(await run(`allow "math" in as Math\nshow Math.double(4)\n`), ['8']);
    assert.deepEqual(await run(`import {double} from "math"\nshow double(5)\n`), ['10']);
    assert.deepEqual(await run(`
fn square(x) { return x * x }
let squares = map(range(4), square)
show join(squares, ",")
`), ['0,1,4,9']);
    assert.deepEqual(await run(`
show type(true)
show num("12.5px")
show num("invalid")
show len(null)
show from_json("{")
show url_encode("São Paulo & region")
show url_encode(1)
let page = html("<p>Hi</p>", {title: "Test"})
show contains(page, "<title>Test</title>")
`), ['bool', '12.5', 'null', 'null', 'null', 'S%C3%A3o%20Paulo%20%26%20region', 'null', 'true']);

    assert.deepEqual(await run(`
allow "std/math" in as Math
fn greet(name = "World") { return "Hello, " + name }
show greet()
show Math.floor(3.9)
show Math.clamp(4, 0, 2)
show Math.lerp(0, 10, 0.25)
show Math.hash("hello", 42)
let value = null
show value?.missing
try { show 1 } catch (err) { show err }
`), ['Hello, World', '3', '2', '2.5', String((await import('../src/numeric-helpers')).createNumericHelpers().hash('hello', 42)), 'null', '1']);

    assert.deepEqual(await run(`
fn makeAdder(base) {
  fn inner(n) { return base + n }
  return inner
}
let addTen = makeAdder(10)
show addTen(5)
try {
  let bad = null
  bad()
} catch (err) {
  show "caught"
} finally {
  show "finally"
}
async fn greeting(name) { return "Hello, " + name }
show await greeting("Sesi")
`), ['15', 'caught', 'finally', 'Hello, Sesi']);

    assert.deepEqual(await run(`
prompt digits {1 2}
show digits
let evaluations = 0
fn values() { evaluations = evaluations + 1; return [4, 5] }
for value in values() { show value }
show evaluations
fn limit() { evaluations = evaluations + 1; return 2 }
for index = 0 to limit() { show index }
show evaluations
let flag = false
show flag?.missing
`), ['12', '4', '5', '1', '0', '1', '2', 'null']);

    const button: { textContent: string; click?: () => Promise<unknown>; addEventListener: (event: string, callback: () => Promise<unknown>) => void } = {
      textContent: '',
      addEventListener(event, callback) { assert.equal(event, 'click'); this.click = callback; },
    };
    const oldDocument = (globalThis as any).document;
    (globalThis as any).document = { querySelector: () => button };
    try {
      await run(`
let count = 0
let button = document.querySelector("#counter")
fn update() {
  count = count + 1
  button.textContent = "Clicked " + count
}
button.addEventListener("click", update)
`, false);
      await button.click?.();
      await button.click?.();
      assert.equal(button.textContent, 'Clicked 2');
    } finally {
      (globalThis as any).document = oldDocument;
    }

    const files = new Map<string, Uint8Array>();
    const folders = new Set(['']);
    const notFound = (): Error => Object.assign(new Error('Not found'), { name: 'NotFoundError' });
    const folder = (prefix: string): any => ({
      async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
        const key = prefix + name + '/';
        if (!folders.has(key)) { if (!options.create) throw notFound(); folders.add(key); }
        return folder(key);
      },
      async getFileHandle(name: string, options: { create?: boolean } = {}) {
        const key = prefix + name;
        if (!files.has(key)) { if (!options.create) throw notFound(); files.set(key, new Uint8Array()); }
        return {
          async getFile() { return new Blob([files.get(key)!]); },
          async createWritable({ keepExistingData = false } = {}) {
            let contents = keepExistingData ? files.get(key)! : new Uint8Array();
            let position = 0;
            return {
              async seek(offset: number) { position = offset; },
              async write(value: string | Uint8Array) {
                const data = typeof value === 'string' ? new TextEncoder().encode(value) : value;
                const next = new Uint8Array(Math.max(contents.length, position + data.length));
                next.set(contents); next.set(data, position); contents = next; position += data.length;
              },
              async close() { files.set(key, contents); },
            };
          },
        };
      },
      async *entries() {
        for (const key of folders) if (key.startsWith(prefix) && key !== prefix && !key.slice(prefix.length, -1).includes('/')) yield [key.slice(prefix.length, -1), {}];
        for (const key of files.keys()) if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) yield [key.slice(prefix.length), {}];
      },
    });
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { getDirectory: async () => folder('') } } });
    (globalThis as any).fetch = async (url: string, options: any = {}) => {
      if (url === 'deployed.txt') return { ok: true, status: 200, blob: async () => new Blob(['deployed']) };
      if (url === '/api' && options.method === 'GET') return { text: async () => 'response' };
      if (url === '/api' && options.method === 'POST') return { text: async () => options.body };
      if (url.endsWith(':generateContent')) {
        assert.equal(options.headers['x-goog-api-key'], 'test-gemini-key');
        const body = JSON.parse(options.body);
        if (url.includes('gemini-4-argon')) assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'high' });
        const image = body.generationConfig?.responseModalities?.includes('IMAGE');
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: image
          ? [{ inlineData: { data: 'aW1hZ2U=' } }] : [{ text: 'browser answer' }] } }] }) };
      }
      if (url.endsWith(':embedContent')) {
        assert.equal(options.headers['x-goog-api-key'], 'test-gemini-key');
        return { ok: true, json: async () => ({ embedding: { values: [1, 0] } }) };
      }
      if (url === 'https://generativelanguage.googleapis.com/v1beta/interactions') {
        assert.equal(options.headers['x-goog-api-key'], 'test-gemini-key');
        return { ok: true, json: async () => ({ steps: [{ type: 'model_output',
          content: [{ type: 'video', data: 'b21uaQ==' }] }] }) };
      }
      if (url === 'https://api.openai.com/v1/responses') {
        assert.equal(options.headers.Authorization, 'Bearer test-openai-key');
        assert.deepEqual(JSON.parse(options.body).reasoning, { effort: 'max' });
        return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'gpt answer' }] }] }) };
      }
      throw new Error('Unexpected fetch: ' + url);
    };
    const oldGeminiKey = (globalThis as any).GEMINI_API_KEY;
    const oldOpenAIKey = (globalThis as any).OPENAI_API_KEY;
    const oldCreateImageBitmap = (globalThis as any).createImageBitmap;
    const oldOffscreenCanvas = (globalThis as any).OffscreenCanvas;
    (globalThis as any).GEMINI_API_KEY = 'test-gemini-key';
    (globalThis as any).OPENAI_API_KEY = 'test-openai-key';
    (globalThis as any).createImageBitmap = async () => ({ width: 2, height: 2, close() {} });
    (globalThis as any).OffscreenCanvas = class {
      constructor(public width: number, public height: number) {}
      getContext() { return { drawImage() {} }; }
      async convertToBlob({ type }: { type: string }) { return new Blob(['webp'], { type }); }
    };
    try {
      assert.deepEqual(await run(`
show make_dir("docs")
show write_file("docs/index.html", html("<p>Hi</p>"))
show contains(read_file("docs/index.html"), "<p>Hi</p>")
show append_file("docs/index.html", "MORE")
show contains(read_file("docs/index.html"), "MORE")
show exists("docs/index.html")
show join(list_dir("docs"), ",")
show write_file("docs/data.bin", "SGk=", "base64")
show read_file("docs/data.bin")
show read_file("docs/data.bin", "base64")
show read_file("deployed.txt")
show web_get("/api")
show web_send("/api", {ok: true})
`, false), ['true', 'true', 'true', 'true', 'true', 'true', 'index.html', 'true', 'Hi', 'SGk=', 'deployed', 'response', '{"ok":true}']);
      assert.deepEqual(await run(`
memory chat {"hello"}
chat = chat + " world"
show chat
show memory_config("chat", {max_tokens: 1000}).max_tokens
show memory_search("chat", "hello")[0].text
show memory_trim("chat")
show model("gemini-4-argon") {thinkingLevel: "high"} {"question"}
show model("gpt-6.1-sol") {thinkingLevel: "max"} {"question"}
let picture = image("gemini-3.1-flash-image") {"draw"}
show picture
show video("gemini-omni-1.1-flash") {"make a clip"}
`, false), ['hello world', '1000', 'hello world', 'hello world', 'browser answer', 'gpt answer', 'aW1hZ2U=', 'b21uaQ==']);
      assert.deepEqual(await run(`
show write_file("diagram.svg", "<svg></svg>")
let converted = convert(media) {output_type: "webp"} {"diagram.svg"}
show converted
show read_file(converted)
`, false), ['true', 'diagram.webp', 'webp']);
    } finally {
      (globalThis as any).GEMINI_API_KEY = oldGeminiKey;
      (globalThis as any).OPENAI_API_KEY = oldOpenAIKey;
      (globalThis as any).createImageBitmap = oldCreateImageBitmap;
      (globalThis as any).OffscreenCanvas = oldOffscreenCanvas;
      globalThis.fetch = originalFetch;
      if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
      else delete (globalThis as any).navigator;
    }

    const unsupported = path.join(directory, 'unsupported.sesi');
    fs.writeFileSync(unsupported, 'show exec("echo secret")\n');
    compileSesiForBrowser(unsupported, path.join(directory, 'unsupported.js'));
    await assert.rejects(
      import(`data:text/javascript,${encodeURIComponent(fs.readFileSync(path.join(directory, 'unsupported.js'), 'utf8'))}`),
      /Browser built-in unavailable: exec/,
    );
    fs.writeFileSync(unsupported, 'let response = model("gemini") {"hello"}\n');
    compileSesiForBrowser(unsupported, path.join(directory, 'unsupported.js'));
    assert.match(fs.readFileSync(path.join(directory, 'unsupported.js'), 'utf8'), /__sesi\.host\("model"/);
    fs.writeFileSync(unsupported, 'import {Missing} from "math"\n');
    assert.throws(() => compileSesiForBrowser(unsupported, path.join(directory, 'unsupported.js')), /does not export Missing/);
    fs.writeFileSync(path.join(directory, 'cycle.sesi'), 'allow "other" in as Other\n');
    fs.writeFileSync(path.join(directory, 'other.sesi'), 'allow "cycle" in as Cycle\n');
    assert.throws(() => compileSesiForBrowser(path.join(directory, 'cycle.sesi'), path.join(directory, 'cycle.js')), /Circular browser imports/);
    originalLog('Browser compiler tests passed');
  } finally {
    console.log = originalLog;
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
