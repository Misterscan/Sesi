import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { VM } from '../src/vm';
import { Interpreter } from '../src/interpreter';
import { aiRuntime, AIRuntime } from '../src/ai-runtime';
import { compileSesiForBrowser } from '../src/browser-compiler';

async function main() {
  const source = `
    let picture = image("gpt-image-2") {background: "transparent"} {"sticker"}
    let edited = image("gpt-image-2") {background: "transparent", images: "ref.png"} {"edit"}
    let opaque = image("gpt-image-2") {background: "opaque"} {"photo"}
  `;
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert.deepEqual(parser.errors, []);
  const compiler = new Compiler();
  const chunk = compiler.compileProgram(program);
  assert.deepEqual(compiler.errors, []);
  const originalCall = aiRuntime.callModel;
  const requests: any[] = [];
  aiRuntime.callModel = async request => { requests.push(request); return { text: 'aW1hZ2U=' }; };
  try {
    const fallback = new VM();
    (fallback as any).interpreter.evaluateImageCall = undefined;
    for (const run of [() => new Interpreter().interpret(program), () => new VM().run(chunk), () => fallback.run(chunk)]) {
      requests.length = 0;
      await run();
      assert.equal(requests.length, 3);
      assert.equal(requests[0].background, 'transparent');
      assert.deepEqual(requests[1].images, ['ref.png']);
      assert.equal(requests[2].background, 'opaque');
    }
  } finally { aiRuntime.callModel = originalCall; }

  const runtime = new AIRuntime() as any;
  const base = { model: 'gpt-image-2', prompt: 'sticker' };
  const hash = (extra: any) => runtime.computeCacheHash({ ...base, ...extra });
  assert.notEqual(hash({}), hash({ background: 'transparent' }));

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-transparency-'));
  const originalFetch = globalThis.fetch;
  const originalKey = (globalThis as any).OPENAI_API_KEY;
  let calls = 0;
  (globalThis as any).OPENAI_API_KEY = 'test-key';
  (globalThis as any).fetch = async (url: string, options: any) => {
    if (url.startsWith('data:')) return originalFetch(url);
    const body = options.body as FormData;
    assert.equal(body.get('background'), 'transparent');
    assert.equal(url, 'https://api.openai.com/v1/images/' + (calls === 0 ? 'generations' : 'edits'));
    if (calls === 1) assert.equal(body.getAll('image[]').length, 1);
    calls++;
    return { ok: true, json: async () => ({ data: [{ b64_json: 'aW1hZ2U=' }] }) };
  };
  try {
    const input = path.join(directory, 'image.sesi');
    const output = path.join(directory, 'image.js');
    fs.writeFileSync(input, `
      let a = image("gpt-image-2") {background: "transparent"} {"sticker"}
      let b = image("gpt-image-2") {background: "transparent", images: "data:image/png;base64,aW1hZ2U="} {"edit"}
    `);
    compileSesiForBrowser(input, output);
    await import(`data:text/javascript,${encodeURIComponent(fs.readFileSync(output, 'utf8'))}`);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).OPENAI_API_KEY = originalKey;
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log('Image transparency tests passed (interpreter, VM, VM fallback, cache, browser).');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
