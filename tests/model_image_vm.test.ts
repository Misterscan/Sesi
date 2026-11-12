import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { VM } from '../src/vm';
import { aiRuntime } from '../src/ai-runtime';
import type { AIRequest, AIResponse } from '../src/ai-runtime';

declare const process: any;

function assert(name: string, condition: boolean, detail?: string): void {
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
  }
  console.log(`  ✓ ${name}`);
}

async function main(): Promise<void> {
  console.log('=== VM model() media input regression tests ===\n');

  const source = `
    let singlePath = "single-variable.png"
    let imageList = ["first.png", "second.png"]

    let literalResult = model("gemini-test") {images: "single-literal.png"} {"literal"}
    let variableResult = model("gemini-test") {images: singlePath} {"variable"}
    let arrayResult = model("gemini-test") {images: imageList} {"array"}
    let mixedResult = model("gemini-test") {images: singlePath, temperature: 0, max_tokens: 128} {"mixed"}
    let audioPathResult = model("gemini-test") {audio: "voice.wav"} {"audio path"}
    let audioDataResult = model("gemini-test") {audio: {data: "base64-audio", mimeType: "audio/wav"}} {"audio data"}
  `;

  const parser = new Parser(new Lexer(source).scanTokens());
  const program = parser.parse();
  assert('source parses without errors', parser.errors.length === 0, parser.errors.join('; '));

  const compiler = new Compiler();
  const chunk = compiler.compileProgram(program);
  assert('source compiles without errors', compiler.errors.length === 0, compiler.errors.join('; '));

  const originalCallModel = aiRuntime.callModel.bind(aiRuntime);
  const requests: AIRequest[] = [];
  (aiRuntime as any).callModel = async (request: AIRequest): Promise<AIResponse> => {
    requests.push(request);
    return {
      text: 'ok',
      finishReason: 'STOP',
      usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 },
    };
  };

  try {
    await new VM().run(chunk);
  } finally {
    (aiRuntime as any).callModel = originalCallModel;
  }

  assert('all model calls reach the provider', requests.length === 6, `got ${requests.length}`);
  assert('literal image path is forwarded', JSON.stringify(requests[0]?.images) === JSON.stringify(['single-literal.png']));
  assert('variable image path is forwarded', JSON.stringify(requests[1]?.images) === JSON.stringify(['single-variable.png']));
  assert('image array is forwarded intact', JSON.stringify(requests[2]?.images) === JSON.stringify(['first.png', 'second.png']));
  assert('mixed config forwards images', JSON.stringify(requests[3]?.images) === JSON.stringify(['single-variable.png']));
  assert('mixed config preserves temperature zero', requests[3]?.temperature === 0, `got ${requests[3]?.temperature}`);
  assert('mixed config preserves max_tokens', requests[3]?.maxTokens === 128, `got ${requests[3]?.maxTokens}`);
  assert('audio path is forwarded', requests[4]?.audio === 'voice.wav');
  assert('base64 audio object is forwarded', (requests[5]?.audio as any)?.data === 'base64-audio');
  assert('audio MIME type is forwarded', (requests[5]?.audio as any)?.mimeType === 'audio/wav');

  console.log('\nVM model() media input regression tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
