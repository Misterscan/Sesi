import {
  AIRuntime,
  DEFAULT_LOCAL_MODEL,
  DEFAULT_LOCAL_MODEL_WARNING_TOKENS,
} from '../src/ai-runtime';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
  assert(DEFAULT_LOCAL_MODEL === 'onnx-community/Qwen2.5-0.5B-Instruct', 'default local model is public');
  assert(DEFAULT_LOCAL_MODEL_WARNING_TOKENS === 2048, 'local warning threshold is public');

  const runtime = new AIRuntime() as any;
  const calls: Array<{ model: string; messages: any[]; options: Record<string, any> }> = [];

  const tokenizer = {
    all_special_ids: [],
    encode(text: string) {
      return String(text).trim().split(/\s+/).filter(Boolean);
    },
    decode() {
      return '';
    },
  };

  runtime.getLocalPipeline = async (model: string) => {
    const generator: any = async (messages: any[], options: Record<string, any>) => {
      calls.push({ model, messages, options });
      if (options.streamer) {
        options.streamer.callback_function('hello ');
        options.streamer.callback_function('local');
      }
      return [{
        generated_text: [
          ...messages,
          { role: 'assistant', content: 'hello local' },
        ],
      }];
    };
    generator.tokenizer = tokenizer;
    return generator;
  };

  const originalModel = process.env.SESI_LOCAL_MODEL;
  const originalWarningThreshold = process.env.SESI_LOCAL_WARN_TOKENS;
  process.env.SESI_LOCAL_MODEL = 'test/default-local-model';

  try {
    const response = await runtime.callModel({
      model: 'local',
      prompt: 'say hello',
      systemPrompt: 'Follow exactly.',
      temperature: 0.25,
      maxTokens: 42,
      topK: 12,
      topP: 0.8,
      cache: false,
    });

    assert(response.text === 'hello local', 'local response text is returned');
    assert(calls[0].model === 'test/default-local-model', 'environment model is resolved');
    assert(calls[0].messages[0].content === 'Follow exactly.', 'system prompt is forwarded');
    assert(calls[0].options.max_new_tokens === 42, 'max_tokens is forwarded');
    assert(calls[0].options.temperature === 0.25, 'temperature is forwarded');
    assert(calls[0].options.top_k === 12, 'top_k is forwarded');
    assert(calls[0].options.top_p === 0.8, 'top_p is forwarded');
    assert((response.usage?.inputTokens || 0) > 0, 'input usage is reported');
    assert((response.usage?.outputTokens || 0) > 0, 'output usage is reported');

    await runtime.callModel({
      model: 'local:test/explicit-model',
      prompt: 'hello',
      cache: false,
    });
    assert(calls[1].model === 'test/explicit-model', 'local:model selects an explicit model');

    let rejectedTraversal = false;
    try {
      await runtime.callModel({
        model: 'local:../../private',
        prompt: 'hello',
        cache: false,
      });
    } catch (error: any) {
      rejectedTraversal = /Invalid local model ID/.test(error.message);
    }
    assert(rejectedTraversal, 'local model IDs reject path traversal');

    let streamed = '';
    const streamedResponse = await runtime.callModel({
      model: 'local',
      prompt: 'stream hello',
      cache: false,
      stream: async (chunk: string) => {
        streamed += chunk;
      },
    });
    assert(streamed === 'hello local', 'local streaming callback receives deltas');
    assert(streamedResponse.text === 'hello local', 'streaming returns the complete text');

    runtime.getLocalTokenizer = async () => tokenizer;
    const tokenCount = await runtime.countTokens('local', 'one two three');
    assert(tokenCount === 3, 'local token counting uses the local tokenizer');

    const warnings: string[] = [];
    const originalWarn = console.warn;
    process.env.SESI_LOCAL_WARN_TOKENS = '1';
    console.warn = (message?: any) => warnings.push(String(message));
    try {
      await runtime.callModel({
        model: 'local',
        prompt: 'this prompt exceeds one token',
        cache: false,
      });
    } finally {
      console.warn = originalWarn;
    }
    assert(
      warnings.some((warning) => warning.includes('recommended CPU threshold is 1')),
      'large local prompts emit the public performance warning'
    );
  } finally {
    if (originalModel === undefined) {
      delete process.env.SESI_LOCAL_MODEL;
    } else {
      process.env.SESI_LOCAL_MODEL = originalModel;
    }
    if (originalWarningThreshold === undefined) {
      delete process.env.SESI_LOCAL_WARN_TOKENS;
    } else {
      process.env.SESI_LOCAL_WARN_TOKENS = originalWarningThreshold;
    }
  }

  console.log('✓ local model runtime routing, config, streaming, and token usage');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
