import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { VM } from '../src/vm';
import { Interpreter } from '../src/interpreter';
import { AIRuntime, aiRuntime } from '../src/ai-runtime';
import { browserJsRuntime } from '../src/browser-js-runtime';
import { normalizeVideoInputs } from '../src/video-input';

async function main() {
  const data = Buffer.from('mock video bytes').toString('base64');
  const inline = { data, mimeType: 'video/mp4' };
  const uri = 'https://generativelanguage.googleapis.com/v1beta/files/test-video';
  const source = `
    let clip = "clip.mp4"
    let summary = model("gemini-4-argon") {videos: clip, cache: false} {"Summarize"}
    let comparison = model("gemini-4-argon") {video: [clip, {uri: "${uri}", mimeType: "video/mp4"}]} {"Compare"}
    let poster = image("gemini-3.1-flash-image") {videos: {data: "${data}", mimeType: "video/mp4"}} {"Poster"}
    let still = image("gemini-3.1-flash-image") {video: "https://www.youtube.com/watch?v=test"} {"Still"}
  `;
  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert.deepEqual(parser.errors, []);
  const compiler = new Compiler();
  const chunk = compiler.compileProgram(program);
  assert.deepEqual(compiler.errors, []);
  const originalCall = aiRuntime.callModel;
  const requests: any[] = [];
  aiRuntime.callModel = async request => { requests.push(request); return { text: 'ok' }; };
  try {
    const fallback = new VM();
    (fallback as any).interpreter.evaluateImageCall = undefined;
    for (const run of [() => new Interpreter().interpret(program), () => new VM().run(chunk), () => fallback.run(chunk)]) {
      requests.length = 0;
      await run();
      assert.equal(requests.length, 4);
      assert.deepEqual(requests[0].videos, [path.resolve('clip.mp4')]);
      assert.deepEqual(requests[1].videos, [path.resolve('clip.mp4'), { uri, mimeType: 'video/mp4' }]);
      assert.deepEqual(requests[2].videos, [inline]);
      assert.deepEqual(requests[3].videos, ['https://www.youtube.com/watch?v=test']);
    }
    const bad = new Parser(new Lexer('let x = model("gemini-4-argon") {videos: "../outside.mp4"} {"test"}').scanTokens()).parse();
    await assert.rejects(() => new Interpreter().interpret(bad), /Security Violation/);
    const badCompiler = new Compiler();
    await assert.rejects(() => new VM().run(badCompiler.compileProgram(bad)), /Security Violation/);
  } finally { aiRuntime.callModel = originalCall; }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-video-input-'));
  try {
    const file = path.join(directory, 'clip.MP4');
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    const runtime = new AIRuntime() as any;
    const seen: any[] = [];
    runtime._client = { models: {
      generateContent: async (body: any) => {
        seen.push(body);
        return { candidates: [{ finishReason: 'STOP', content: { parts: body.config.responseModalities
          ? [{ inlineData: { data: 'aW1hZ2U=', mimeType: 'image/png' } }] : [{ text: 'summary' }] } }] };
      },
      generateContentStream: async function* (body: any) {
        seen.push(body);
        yield { text: 'streamed', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'streamed' }] } }] };
      },
    } };
    const base = { model: 'gemini-4-argon', prompt: 'Summarize', cache: false };
    await runtime.callModel({ ...base, videos: [file, { uri, mimeType: 'video/mp4' }, `data:video/mp4;base64,${data}`] });
    const parts = seen[0].contents[0].parts;
    assert.deepEqual(parts[0], { inlineData: inline });
    assert.deepEqual(parts[1], { fileData: { fileUri: uri, mimeType: 'video/mp4' } });
    assert.deepEqual(parts[2], { inlineData: inline });
    assert.deepEqual(parts[3], { text: 'Summarize' });
    const chunks: string[] = [];
    const streamed = await runtime.callModel({ ...base, videos: inline, stream: (text: string) => { chunks.push(text); } });
    assert.equal(streamed.text, 'streamed');
    assert.deepEqual(chunks, ['streamed']);
    assert.deepEqual(seen[1].contents[0].parts[0], { inlineData: inline });
    const image = await runtime.callModel({ ...base, model: 'gemini-3.1-flash-image', videos: inline });
    assert.equal(image.text, 'aW1hZ2U=');
    assert.deepEqual(seen[2].contents[0].parts[0], { inlineData: inline });
    assert.ok(seen[2].config.responseModalities.includes('IMAGE'));
    const hash = (videos: any) => runtime.computeCacheHash(runtime.resolveVideoInputs({ ...base, videos }));
    assert.equal(hash(file), hash(inline));
    const before = hash(file);
    fs.writeFileSync(file, 'changed video');
    assert.notEqual(hash(file), before, 'replacing a video invalidates the cache');
    assert.notEqual(hash({ uri }), hash({ uri: uri + '2' }));
    for (const model of ['gpt-6.1-sol', 'gpt-image-2', 'local']) {
      await assert.rejects(() => runtime.callModel({ ...base, model, videos: 'missing.mp4' }), /Video input is not supported/);
    }
    await assert.rejects(() => runtime.callModel({ ...base, videos: 'missing.mp4' }), /file was not found/);
    await assert.rejects(() => runtime.callModel({ ...base, videos: 'clip.unknown' }), /infer the video MIME/);
    for (const videos of ['', 123, { data, mimeType: 'image/png' }, { data: '%%%bad', mimeType: 'video/mp4' }, { uri: 'file:///secret' }]) {
      await assert.rejects(() => runtime.callModel({ ...base, videos }), /Video input/);
    }
    await assert.rejects(() => runtime.callModel({ ...base, videos: 'data:audio/wav;base64,' + data }), /Video data URLs/);
    await assert.rejects(() => runtime.callModel({ ...base, videos: { data: 'A'.repeat(19_000_001), mimeType: 'video/mp4' } }), /too large/);
    assert.deepEqual(normalizeVideoInputs([]), []);
    assert.equal(seen.length, 3, 'invalid and unsupported inputs never reach the SDK');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }

  const originalFetch = globalThis.fetch;
  const originalKey = (globalThis as any).GEMINI_API_KEY;
  const browserRequests: any[] = [];
  (globalThis as any).GEMINI_API_KEY = 'test-key';
  globalThis.fetch = (async (_url: any, options: any) => {
    const body = JSON.parse(options.body);
    browserRequests.push(body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: body.generationConfig?.responseModalities
      ? [{ inlineData: { data: 'aW1hZ2U=' } }] : [{ text: 'summary' }] } }] }) };
  }) as any;
  try {
    // The browser compiler embeds this exact runtime; exercise its public host entry point.
    const browser = browserJsRuntime();
    assert.equal(await browser.host('model', ['gemini-4-argon', 'Summarize', { videos: [inline, { uri }] }]), 'summary');
    assert.deepEqual(browserRequests[0].contents[0].parts.slice(0, 2), [
      { inlineData: inline }, { fileData: { fileUri: uri } },
    ]);
    assert.equal(await browser.host('image', ['gemini-3.1-flash-image', 'Poster', { video: `data:video/mp4;base64,${data}` }]), 'aW1hZ2U=');
    await assert.rejects(() => browser.host('model', ['gpt-6.1-sol', 'Summary', { videos: inline }]), /Video input is not supported/);
    await assert.rejects(() => browser.host('image', ['gpt-image-2', 'Poster', { videos: inline }]), /Video input is not supported/);
    await assert.rejects(() => browser.host('model', ['gemini-4-argon', 'Summary', { videos: 123 }]), /Video input/);
    assert.equal(browserRequests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).GEMINI_API_KEY = originalKey;
  }
  console.log('Video input tests passed (interpreter, VM, VM fallback, Gemini text/image/streaming, cache, validation, browser).');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
