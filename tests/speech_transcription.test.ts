import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { aiRuntime, AIRuntime } from '../src/ai-runtime';
import { getBuiltins } from '../src/builtins';
import { compileSesiForBrowser } from '../src/browser-compiler';
import { browserJsRuntime } from '../src/browser-js-runtime';
import { Compiler } from '../src/compiler';
import { Interpreter } from '../src/interpreter';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { VM } from '../src/vm';

async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-transcription-'));
  const audio = Buffer.from('mock audio bytes');
  const audioPath = path.join(folder, 'recording.m4a');
  fs.writeFileSync(audioPath, audio);
  const runtime = aiRuntime as any;
  const originalClient = runtime._openAIClient;
  const originalCallModel = runtime.callModel;
  const originalFetch = globalThis.fetch;
  const originalEnvironment = (globalThis as any).SESI_ENV;
  const originalLog = console.log;
  const openaiRequests: any[] = [], geminiRequests: any[] = [];
  runtime._openAIClient = { audio: { transcriptions: { create: async (request: any) => {
    openaiRequests.push(request);
    assert.equal(request.file.name, 'recording.m4a');
    assert.equal(request.file.type, 'audio/mp4');
    assert.deepEqual(Buffer.from(await request.file.arrayBuffer()), audio);
    assert.equal(request.response_format, 'json');
    return { text: 'OpenAI transcript' };
  } } } };
  runtime.callModel = async (request: any) => {
    geminiRequests.push(request);
    assert.deepEqual(request.audio, { data: audio.toString('base64'), mimeType: 'audio/mp4' });
    assert.equal(request.cache, false);
    assert.match(request.prompt, /spoken language is fr/);
    return { text: 'Gemini transcript' };
  };
  try {
    const source = `
let defaultTranscript = from_speech(${JSON.stringify(audioPath)}, "en")
let openaiTranscript = ${JSON.stringify(audioPath)} | from_speech(null, "gpt-4o-mini-transcribe")
let geminiTranscript = from_speech(${JSON.stringify(audioPath)}, "fr", "gemini-3.5-flash-lite")
`;
    for (const engine of ['interpreter', 'vm']) {
      const parser = new Parser(new Lexer(source).scanTokens());
      const program = parser.parse();
      assert.deepEqual(parser.errors, []);
      let get: (name: string) => any;
      if (engine === 'interpreter') {
        const interpreter = new Interpreter(folder);
        await interpreter.interpret(program);
        get = name => (interpreter as any).currentEnv.get(name);
      } else {
        const compiler = new Compiler();
        const chunk = compiler.compileProgram(program);
        assert.deepEqual(compiler.errors, []);
        const vm = new VM(folder);
        await vm.run(chunk);
        get = name => (vm as any).globals.get(name);
      }
      assert.equal(get('defaultTranscript'), 'OpenAI transcript');
      assert.equal(get('openaiTranscript'), 'OpenAI transcript');
      assert.equal(get('geminiTranscript'), 'Gemini transcript');
    }
    assert.deepEqual(openaiRequests.map(request => request.model),
      ['gpt-transcribe', 'gpt-4o-mini-transcribe', 'gpt-transcribe', 'gpt-4o-mini-transcribe']);
    assert.equal(openaiRequests[0].language, 'en');
    assert.equal(openaiRequests[1].language, undefined);
    const fromSpeech = getBuiltins({ allowedPaths: [folder] }).get('from_speech')!.builtin!;
    await assert.rejects(async () => fromSpeech(''), /audio file path/);
    await assert.rejects(async () => fromSpeech(audioPath, 42), /language must be a string/);
    await assert.rejects(async () => fromSpeech(audioPath, null, ''), /model must be a non-empty string/);
    await assert.rejects(async () => fromSpeech(path.join(folder, 'missing.wav')), /does not exist/);
    await assert.rejects(async () => fromSpeech(audioPath, null, 'local'), /OpenAI transcription model or Gemini/);
    runtime._openAIClient.audio.transcriptions.create = async () => { throw new Error('provider rejected audio'); };
    await assert.rejects(async () => fromSpeech(audioPath), /provider rejected audio/);
    const key = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await assert.rejects(() => new AIRuntime().transcribeSpeech(audio.toString('base64'), 'audio/mp4'), /OPENAI_API_KEY/);
    } finally { if (key !== undefined) process.env.OPENAI_API_KEY = key; }

    const browserRequests: any[] = [];
    (globalThis as any).SESI_ENV = { OPENAI_API_KEY: 'test-openai-key', GEMINI_API_KEY: 'test-gemini-key' };
    globalThis.fetch = (async (url: string, options: any = {}) => {
      if (url === 'deployed-recording.m4a') return new Response(new Blob([audio]));
      browserRequests.push({ url, options });
      if (url === 'https://api.openai.com/v1/audio/transcriptions') {
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Authorization, 'Bearer test-openai-key');
        assert.equal(options.headers['Content-Type'], undefined);
        const file = options.body.get('file');
        assert.equal(file.name, 'deployed-recording.m4a');
        assert.equal(file.type, 'audio/mp4');
        assert.deepEqual(Buffer.from(await file.arrayBuffer()), audio);
        assert.equal(options.body.get('response_format'), 'json');
        return Response.json({ text: 'OpenAI browser transcript' });
      }
      assert.match(url, /gemini-3\.5-flash-lite:generateContent$/);
      assert.equal(options.headers['x-goog-api-key'], 'test-gemini-key');
      const parts = JSON.parse(options.body).contents[0].parts;
      assert.match(parts[0].text, /spoken language is fr/);
      assert.deepEqual(parts[1].inlineData, { mimeType: 'audio/mp4', data: audio.toString('base64') });
      return Response.json({ candidates: [{ content: { parts: [{ text: 'Gemini browser transcript' }] } }] });
    }) as typeof fetch;
    const entry = path.join(folder, 'browser.sesi');
    fs.writeFileSync(entry, `
show from_speech("deployed-recording.m4a", "en")
show "deployed-recording.m4a" | from_speech(null, "gpt-4o-mini-transcribe")
show from_speech("deployed-recording.m4a", "fr", "gemini-3.5-flash-lite")
`);
    const build = compileSesiForBrowser(entry, path.join(folder, 'browser.js'));
    const lines: string[] = [];
    console.log = value => lines.push(String(value));
    await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(build.javascript, 'utf8')));
    console.log = originalLog;
    assert.deepEqual(lines, ['OpenAI browser transcript', 'OpenAI browser transcript', 'Gemini browser transcript']);
    assert.equal(browserRequests[0].options.body.get('model'), 'gpt-transcribe');
    assert.equal(browserRequests[0].options.body.get('language'), 'en');
    assert.equal(browserRequests[1].options.body.get('model'), 'gpt-4o-mini-transcribe');
    assert.equal(browserRequests[1].options.body.get('language'), null);
    const browser = browserJsRuntime();
    // A successful audio read followed by a rejected transcription request.
    globalThis.fetch = (async (url: string) => url === 'deployed-recording.m4a'
      ? new Response(new Blob([audio])) : new Response('provider rejected audio', { status: 400 })) as typeof fetch;
    await assert.rejects(() => browser.builtin('from_speech', ['deployed-recording.m4a']), /Speech transcription failed \(400\)/);
    fs.writeFileSync(entry, 'show from_speech("recording.m4a")');
    const packaged = compileSesiForBrowser(entry, path.join(folder, 'packaged.js'));
    assert.equal(JSON.parse(fs.readFileSync(packaged.assets!, 'utf8'))['recording.m4a'].type, 'audio/mp4');
    console.log('Speech transcription tests passed (interpreter, VM, and compiled JavaScript)');
  } finally {
    runtime._openAIClient = originalClient;
    runtime.callModel = originalCallModel;
    globalThis.fetch = originalFetch;
    if (originalEnvironment === undefined) delete (globalThis as any).SESI_ENV;
    else (globalThis as any).SESI_ENV = originalEnvironment;
    console.log = originalLog;
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
