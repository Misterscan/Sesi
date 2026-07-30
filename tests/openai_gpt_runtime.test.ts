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

    assert(
      'tools payload uses the Responses API shape',
      Array.isArray(seenTools) && seenTools.length === 1 && seenTools[0]?.name === 'lookup_weather'
    );
    assert('finish reason is TOOL_CALL', res.finishReason === 'TOOL_CALL', `got ${res.finishReason}`);

    const parsed = JSON.parse(res.text);
    assert('tool name mapped', parsed.name === 'lookup_weather', `got ${parsed.name}`);
    assert('tool args parsed', parsed.args?.city === 'NYC', `got ${JSON.stringify(parsed.args)}`);
    assert('tool call id mapped', parsed.call_id === 'call_123', `got ${parsed.call_id}`);
  }

  // 4) GPT web search and system instructions
  console.log('\n4. GPT web search and system instructions...');
  {
    let seenBody: any = null;
    const rt = new AIRuntime() as any;
    rt.postOpenAIResponses = async (body: any) => {
      seenBody = body;
      return { status: 'completed', output_text: 'search result' };
    };

    await rt.callModel({
      model: 'gpt-5.6-luna',
      prompt: 'Find the current forecast.',
      systemPrompt: 'Answer concisely.',
      search: true,
      cache: false,
    });

    assert('search adds the OpenAI web search tool', seenBody?.tools?.some((tool: any) => tool.type === 'web_search'));
    assert('system prompt is sent as instructions', seenBody?.instructions?.includes('Answer concisely.'));
  }

  // 5) GPT image generation
  console.log('\n5. GPT image generation...');
  {
    let seenBody: any = null;
    const rt = new AIRuntime() as any;
    rt._openAIClient = {
      images: {
        generate: async (body: any) => {
          seenBody = body;
          return {
            data: [
              {
                b64_json: 'mock-image-base64',
              },
            ],
          };
        },
      },
    };

    const res = await rt.callModel({
      model: 'gpt-image-2',
      prompt: 'a neon robot cat',
      ratio: '16:9',
      cache: false,
    });

    assert('routes GPT image calls through OpenAI images.generate', seenBody?.model === 'gpt-image-2');
    assert('GPT image prompt is forwarded', seenBody?.prompt === 'a neon robot cat', `got ${seenBody?.prompt}`);
    assert('ratio maps to an OpenAI-compatible size', seenBody?.size === '1536x1024', `got ${seenBody?.size}`);
    assert('GPT image response returns base64', res.text === 'mock-image-base64', `got ${res.text}`);
  }

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
