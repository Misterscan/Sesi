import { AIRuntime } from '../src/ai-runtime';

declare var process: any;

async function main() {
  console.log('=== OpenAI GPT Runtime (Mocked) Tests ===\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

  // 1) Non-stream GPT text response
  console.log('1. Non-stream GPT text response...');
  {
    const rt = new AIRuntime() as any;
    rt.postOpenAIResponses = async () => ({
      status: 'completed',
      output_text: 'hello from mocked gpt',
      usage: { input_tokens: 11, output_tokens: 4 },
    });

    const res = await rt.callModel({
      model: 'gpt-5.6-sol',
      prompt: 'say hello',
      cache: false,
    });

    assert('returns expected text', res.text === 'hello from mocked gpt', `got ${res.text}`);
    assert('maps usage input tokens', (res.usage?.inputTokens ?? -1) === 11);
    assert('maps usage output tokens', (res.usage?.outputTokens ?? -1) === 4);
  }

  // 2) Streaming GPT deltas
  console.log('\n2. Streaming GPT deltas via callback...');
  {
    let seenBody: any = null;
    const rt = new AIRuntime() as any;
    rt.streamOpenAIResponses = async (body: any, onDelta: (delta: string) => Promise<void>) => {
      seenBody = body;
      await onDelta('Hello ');
      await onDelta('streaming ');
      await onDelta('world');
      return {
        text: 'Hello streaming world',
        response: {
          status: 'completed',
          usage: { input_tokens: 21, output_tokens: 3 },
        },
      };
    };

    const chunks: string[] = [];
    const res = await rt.callModel({
      model: 'gpt-5.6-sol',
      prompt: 'stream hello',
      stream: async (chunk: string) => {
        chunks.push(chunk);
      },
      cache: false,
    });

    assert('stream path uses streaming helper', seenBody !== null);
    assert('callback receives all chunks', chunks.join('') === 'Hello streaming world', `got ${chunks.join('')}`);
    assert('final response text matches chunks', res.text === 'Hello streaming world', `got ${res.text}`);
  }

  // 3) GPT tool call handling
  console.log('\n3. GPT tool-call response mapping...');
  {
    let seenTools: any = null;
    const rt = new AIRuntime() as any;
    rt.postOpenAIResponses = async (body: any) => {
      seenTools = body.tools;
      return {
        status: 'completed',
        output: [
          {
            type: 'function_call',
            name: 'lookup_weather',
            arguments: '{"city":"NYC"}',
            call_id: 'call_123',
          },
        ],
        usage: { input_tokens: 17, output_tokens: 2 },
      };
    };

    const res = await rt.callModel({
      model: 'gpt-5.6-sol',
      prompt: 'what is weather in nyc',
      tools: [
        {
          type: 'function',
          function: {
            name: 'lookup_weather',
            description: 'Get weather by city',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string' },
              },
              required: ['city'],
            },
          },
        },
      ],
      cache: false,
    });

    assert('tools payload forwarded to OpenAI request', Array.isArray(seenTools) && seenTools.length === 1);
    assert('finish reason is TOOL_CALL', res.finishReason === 'TOOL_CALL', `got ${res.finishReason}`);

    const parsed = JSON.parse(res.text);
    assert('tool name mapped', parsed.name === 'lookup_weather', `got ${parsed.name}`);
    assert('tool args parsed', parsed.args?.city === 'NYC', `got ${JSON.stringify(parsed.args)}`);
    assert('tool call id mapped', parsed.call_id === 'call_123', `got ${parsed.call_id}`);
  }

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
