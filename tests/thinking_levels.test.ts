import * as assert from 'node:assert/strict';
import { AIRuntime } from '../src/ai-runtime';
import { browserJsRuntime } from '../src/browser-js-runtime';

async function main() {
  const rt = new AIRuntime() as any;
  let seen: any;
  rt.postOpenAIResponses = async (body: any) => {
    seen = body;
    return { status: 'completed', output_text: 'ok' };
  };
  rt.streamOpenAIResponses = async (body: any) => {
    seen = body;
    return { text: 'ok', response: { status: 'completed' } };
  };
  rt._client = { models: {
    generateContent: async (body: any) => {
      seen = body;
      return { candidates: [{ finishReason: 'STOP', content: { parts: body.config.responseModalities
        ? [{ inlineData: { data: 'aW1hZ2U=' } }] : [{ text: 'ok' }] } }] };
    },
    generateContentStream: async function* (body: any) {
      seen = body;
      yield { text: 'ok', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }] };
    },
  } };
  const originalFetch = globalThis.fetch;
  const originalKey = (globalThis as any).GEMINI_API_KEY;
  const originalOpenAIKey = (globalThis as any).OPENAI_API_KEY;
  (globalThis as any).GEMINI_API_KEY = 'offline-test-key';
  (globalThis as any).OPENAI_API_KEY = 'offline-test-key';
  try {
    globalThis.fetch = (async (_url: any, options: any) => {
      seen = JSON.parse(options.body);
      return { ok: true, json: async () => ({ output_text: 'ok', candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) };
    }) as any;
    const browser = browserJsRuntime();
    for (const level of ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']) {
      for (const stream of [false, true]) {
        await rt.callModel({ model: 'gpt-6.1-sol', prompt: 'test', thinkingLevel: level, cache: false, stream: stream ? () => {} : false });
        assert.deepEqual(seen.reasoning, { effort: level });
      }
      await browser.host('model', ['gpt-6.1-sol', 'test', { effort: level }]);
      assert.deepEqual(seen.reasoning, { effort: level });
    }
    for (const model of ['gemini-3.6-flash', 'gemini-4-argon', 'models/gemini-4-carbon']) {
      for (const level of ['low', 'medium', 'high']) {
        for (const stream of [false, true]) {
          await rt.callModel({ model, prompt: 'test', thinkingLevel: level, cache: false, stream: stream ? () => {} : false });
          assert.deepEqual(seen.config.thinkingConfig, { thinkingLevel: level });
        }
        await browser.host('model', [model, 'test', { reasoning: level }]);
        assert.deepEqual(seen.generationConfig.thinkingConfig, { thinkingLevel: level });
      }
    }
    for (const [model, value, expected] of [
      ['gemini-3.6-flash', 'minimal', { thinkingLevel: 'minimal' }],
      ['gemini-4-argon', { thinking: 'yes', level: ' HIGH ' }, { thinkingLevel: 'high' }],
      ['gemini-4-argon', 'no', { thinkingLevel: 'low' }],
      ['gemini-3.1-pro-preview', 'none', { thinkingLevel: 'low' }],
      ['gemini-3.6-flash', { thinking: 'no' }, { thinkingLevel: 'minimal' }],
      ['gemini-2.5-flash', 'low', { thinkingBudget: 1024 }],
      ['gemini-2.5-flash', 'medium', { thinkingBudget: 2048 }],
      ['gemini-2.5-flash', 'high', { thinkingBudget: 4096 }],
      ['gemini-2.5-flash', 'none', { thinkingBudget: 0 }],
    ] as const) {
      await rt.callModel({ model, prompt: 'test', thinkingLevel: value, cache: false });
      assert.deepEqual(seen.config.thinkingConfig, expected);
      await browser.host('model', [model, 'test', { thinking: value }]);
      assert.deepEqual(seen.generationConfig.thinkingConfig, expected);
    }
    await rt.callModel({ model: 'gemini-3.1-flash-image', prompt: 'draw', thinkingLevel: 'high', cache: false });
    assert.deepEqual(seen.config.thinkingConfig, { thinkingLevel: 'high' });
    for (const model of ['gpt-6.1-sol', 'gemini-4-argon']) {
      await rt.callModel({ model, prompt: 'test', cache: false });
      assert.equal(seen.reasoning ?? seen.config?.thinkingConfig, undefined);
      await browser.host('model', [model, 'test', {}]);
      assert.equal(seen.reasoning ?? seen.generationConfig?.thinkingConfig, undefined);
      await assert.rejects(() => rt.callModel({ model, prompt: 'test', thinkingLevel: 'typo', cache: false }), /thinkingLevel/);
      await assert.rejects(() => browser.host('model', [model, 'test', { thinkingLevel: 'typo' }]), /thinkingLevel/);
    }
    await assert.rejects(() => rt.callModel({ model: 'gemini-4-argon', prompt: 'test', thinkingLevel: 'xhigh', cache: false }), /Gemini thinkingLevel/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete (globalThis as any).GEMINI_API_KEY;
    else (globalThis as any).GEMINI_API_KEY = originalKey;
    if (originalOpenAIKey === undefined) delete (globalThis as any).OPENAI_API_KEY;
    else (globalThis as any).OPENAI_API_KEY = originalOpenAIKey;
  }
  console.log('Thinking level tests passed: Gemini/GPT, streaming, browser, legacy options, and validation (mocked providers).');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
