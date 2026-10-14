import { AIRuntime } from '../src/ai-runtime';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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

    await rt.callModel({
      model: 'gpt-5.6-sol',
      prompt: 'use a provider-neutral declaration',
      tools: [{
        name: 'lookup_weather',
        description: 'Get weather by city',
        parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
      }],
      cache: false,
    });
    assert(
      'provider-neutral tools are normalized for Responses API',
      seenTools?.[0]?.type === 'function' && seenTools[0]?.name === 'lookup_weather'
    );
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
    let seenEditBody: any = null;
    const rt = new AIRuntime() as any;
    let seenAudioBody: any = null;
    rt._openAIClient = {
      chat: {
        completions: {
          create: async (body: any) => {
            seenAudioBody = body;
            return { choices: [{ message: { content: 'Dark synthesizers, fast drums, and a tense spoken brief about a neon city.' } }] };
          },
        },
      },
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
        edit: async (body: any) => {
          seenEditBody = body;
          return {
            data: [
              {
                b64_json: 'mock-edited-image-base64',
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

    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-gpt-image-edit-'));
    const fixturePath = path.join(fixtureDir, 'reference.png');
    try {
      fs.writeFileSync(fixturePath, Buffer.from('mock-reference-image'));
      const edited = await rt.callModel({
        model: 'gpt-image-2',
        prompt: 'Keep the subject and change the background.',
        images: [fixturePath],
        ratio: '1:1',
        cache: false,
      });

      assert('reference input routes through images.edit', seenEditBody?.model === 'gpt-image-2');
      assert('edit prompt is forwarded', seenEditBody?.prompt === 'Keep the subject and change the background.');
      assert('edit size is forwarded', seenEditBody?.size === '1024x1024');
      assert('local reference is uploaded', Array.isArray(seenEditBody?.image) && seenEditBody.image.length === 1);
      assert('reference upload preserves filename', seenEditBody?.image?.[0]?.name === 'reference.png');
      assert('reference upload preserves MIME type', seenEditBody?.image?.[0]?.type === 'image/png');
      assert('GPT image edit response returns base64', edited.text === 'mock-edited-image-base64', `got ${edited.text}`);

      const audioImage = await rt.callModel({
        model: 'gpt-image-2',
        prompt: 'Create cover art from this sound.',
        audio: { data: 'mock-mp3-base64', mimeType: 'audio/mpeg' },
        cache: false,
      });
      const audioContent = seenAudioBody?.messages?.[0]?.content;
      assert('GPT image audio uses an audio-understanding model', seenAudioBody?.model === 'gpt-audio-1.5');
      assert('GPT image audio requests audio-capable modalities', seenAudioBody?.modalities?.includes('audio'));
      assert('GPT image audio is nested in a Chat Completions user message', audioContent?.[1]?.type === 'input_audio');
      assert('GPT image audio format is forwarded', audioContent?.[1]?.input_audio?.format === 'mp3');
      assert('audio analysis includes non-speech sound in the image prompt', seenBody?.prompt?.includes('Dark synthesizers, fast drums'));
      assert('audio-conditioned GPT image returns base64', audioImage.text === 'mock-image-base64');
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  }

  // 6) GPT image input
  console.log('\n6. GPT image input...');
  {
    let seenBody: any = null;
    const rt = new AIRuntime() as any;
    rt.postOpenAIResponses = async (body: any) => {
      seenBody = body;
      return { status: 'completed', output_text: 'a tiny image' };
    };

    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const res = await rt.callModel({
      model: 'gpt-5.6-sol',
      prompt: 'Describe this image.',
      images: [dataUrl, 'https://example.com/reference.webp'],
      cache: false,
    });

    const content = seenBody?.input?.[0]?.content;
    assert('image input uses a user message', seenBody?.input?.[0]?.role === 'user');
    assert('data URL is sent as input_image', content?.[0]?.type === 'input_image' && content[0]?.image_url === dataUrl);
    assert(
      'HTTP image URL is sent as input_image',
      content?.[1]?.type === 'input_image' && content[1]?.image_url === 'https://example.com/reference.webp'
    );
    assert('prompt is sent as input_text', content?.[2]?.type === 'input_text' && content[2]?.text === 'Describe this image.');
    assert('returns the GPT vision response', res.text === 'a tiny image', `got ${res.text}`);

    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-gpt-image-'));
    const fixturePath = path.join(fixtureDir, 'pixel.png');
    try {
      fs.writeFileSync(fixturePath, Buffer.from('mock-png-bytes'));
      await rt.callModel({
        model: 'gpt-5.6-sol',
        prompt: 'Inspect the local image.',
        images: [fixturePath],
        cache: false,
      });
      const localPart = seenBody?.input?.[0]?.content?.[0];
      assert(
        'local image is encoded as a PNG data URL',
        localPart?.type === 'input_image'
          && localPart?.image_url === `data:image/png;base64,${Buffer.from('mock-png-bytes').toString('base64')}`
      );
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  }

  // 7) GPT audio input
  console.log('\n7. GPT audio input...');
  {
    let seenBody: any = null;
    let seenAudioBody: any = null;
    let audioAnalysis = 'A spoken greeting over soft piano and room ambience.';
    const rt = new AIRuntime() as any;
    rt._openAIClient = {
      chat: {
        completions: {
          create: async (body: any) => {
            seenAudioBody = body;
            return { choices: [{ message: { content: audioAnalysis } }] };
          },
        },
      },
    };
    rt.postOpenAIResponses = async (body: any) => {
      seenBody = body;
      return {
        status: 'completed',
        output_text: 'The recording contains a greeting.',
        usage: { input_tokens: 19, output_tokens: 5 },
      };
    };

    const res = await rt.callModel({
      model: 'gpt-5.6-sol',
      prompt: 'What is in this recording?',
      audio: { data: 'mock-wav-base64', mimeType: 'audio/wav' },
      cache: false,
    });

    assert('audio analysis is sent through Responses', seenBody?.model === 'gpt-5.6-sol');
    assert('audio bytes are attached to the audio-model request', seenAudioBody?.messages?.[0]?.content?.[1]?.input_audio?.data === 'mock-wav-base64');
    assert('audio-model request enables the audio modality', seenAudioBody?.modalities?.includes('audio'));
    assert('audio analysis is appended to the prompt', seenBody?.input?.includes('soft piano and room ambience'));
    assert('no unsupported input_audio block is sent', JSON.stringify(seenBody).includes('input_audio') === false);
    assert('audio-conditioned model response is returned', res.text === 'The recording contains a greeting.', `got ${res.text}`);
    assert('audio usage maps input tokens', res.usage?.inputTokens === 19);

    audioAnalysis = '';
    await rt.callModel({
      model: 'gpt-5.6-sol',
      prompt: 'React to this recording.',
      audio: { data: 'silent-wav-base64', mimeType: 'audio/wav' },
      cache: false,
    });
    assert('empty audio analysis is non-fatal', seenBody?.input?.includes('No audible content could be analyzed'));
  }

  // 8) Native GPT audio model routing
  console.log('\n8. Native GPT audio model routing...');
  {
    let seenAudioBody: any = null;
    let responsesCalled = false;
    const rt = new AIRuntime() as any;
    rt._openAIClient = {
      chat: {
        completions: {
          create: async (body: any) => {
            seenAudioBody = body;
            return {
              choices: [{ finish_reason: 'stop', message: { audio: { transcript: 'A syncopated electronic track with layered percussion.' } } }],
              usage: { prompt_tokens: 31, completion_tokens: 9 },
            };
          },
        },
      },
    };
    rt.postOpenAIResponses = async () => {
      responsesCalled = true;
      throw new Error('Responses must not be called for GPT audio models.');
    };

    const result = await rt.callModel({
      model: 'gpt-audio-1.5',
      prompt: 'Describe the song.',
      systemPrompt: 'Focus on musical details.',
      audio: { data: 'native-audio-base64', mimeType: 'audio/mpeg' },
      cache: false,
    });

    const messages = seenAudioBody?.messages;
    assert('native GPT audio uses the requested model', seenAudioBody?.model === 'gpt-audio-1.5');
    assert('native GPT audio bypasses Responses', responsesCalled === false);
    assert('native GPT audio forwards the system prompt', messages?.[0]?.role === 'system');
    assert('native GPT audio attaches the bytes', messages?.[1]?.content?.[1]?.input_audio?.data === 'native-audio-base64');
    assert('native GPT audio forwards the MP3 format', messages?.[1]?.content?.[1]?.input_audio?.format === 'mp3');
    assert('native GPT audio returns the audio transcript', result.text.includes('syncopated electronic track'));
    assert('native GPT audio maps usage', result.usage?.inputTokens === 31 && result.usage?.outputTokens === 9);
  }

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
