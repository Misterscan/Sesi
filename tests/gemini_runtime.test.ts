import { AIRuntime } from '../src/ai-runtime';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
  const requests: any[] = [];
  const runtime = new AIRuntime() as any;

  runtime._client = {
    models: {
      generateContent: async (request: any) => {
        requests.push(request);
        return {
          candidates: [{
            finishReason: 'STOP',
            content: { parts: [{ text: 'ok' }] },
          }],
          usageMetadata: {
            promptTokenCount: 3,
            candidatesTokenCount: 1,
          },
        };
      },
    },
  };

  const response = await runtime.callModel({
    model: 'gemini-3.5-flash',
    prompt: 'Answer the question.',
    systemPrompt: '  Follow this instruction exactly.  ',
    cache: false,
  });

  assert(response.text === 'ok', 'mock Gemini response is returned');
  assert(requests.length === 1, 'one Gemini request is sent');
  assert(
    requests[0]?.config?.systemInstruction?.endsWith('Follow this instruction exactly.'),
    'Gemini receives the trimmed system instruction after the runtime context'
  );

  await runtime.callModel({
    model: 'gemini-3.5-flash',
    prompt: 'Use a tool if needed.',
    tools: [{
      name: 'lookupWeather',
      description: 'Look up the weather.',
      parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
    }],
    cache: false,
  });
  assert(
    requests[1]?.config?.tools?.[0]?.functionDeclarations?.[0]?.name === 'lookupWeather',
    'Gemini receives provider-neutral function declarations in its native tool wrapper'
  );

  runtime._client.models.generateContent = async () => ({
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ functionCall: { name: 'lookupWeather', args: { city: 'NYC' } } }] },
    }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 },
  });
  const toolResponse = await runtime.callModel({
    model: 'gemini-3.5-flash',
    prompt: 'What is the weather?',
    tools: [{ name: 'lookupWeather', parameters: { type: 'object', properties: {} } }],
    cache: false,
  });
  const toolCall = JSON.parse(toolResponse.text);
  assert(toolResponse.finishReason === 'TOOL_CALL', 'Gemini functionCall parts use the shared tool-call finish reason');
  assert(toolCall.name === 'lookupWeather' && toolCall.args?.city === 'NYC', 'Gemini functionCall parts are normalized');

  let streamedRequest: any = null;
  runtime._client.models.generateContentStream = async function* (request: any) {
    streamedRequest = request;
    yield {
      text: 'streamed',
      candidates: [{
        finishReason: 'STOP',
        content: { parts: [{ text: 'streamed' }] },
      }],
      usageMetadata: {
        promptTokenCount: 3,
        candidatesTokenCount: 1,
      },
    };
  };

  const chunks: string[] = [];
  await runtime.callModel({
    model: 'gemini-3.5-flash',
    prompt: 'Stream the answer.',
    systemPrompt: 'Stream under these rules.',
    stream: (chunk: string) => {
      chunks.push(chunk);
    },
    cache: false,
  });

  assert(chunks.join('') === 'streamed', 'stream callback receives Gemini output');
  assert(
    streamedRequest?.config?.systemInstruction?.endsWith('Stream under these rules.'),
    'Gemini streaming receives the system instruction after the runtime context'
  );

  let imageRequest: any = null;
  runtime._client.models.generateContent = async (request: any) => {
    imageRequest = request;
    return {
      candidates: [{
        finishReason: 'STOP',
        content: { parts: [{ inlineData: { data: 'mock-image' } }] },
      }],
    };
  };

  const imageResponse = await runtime.callModel({
    model: 'gemini-3.1-flash-image',
    prompt: 'Draw the scene.',
    audio: { data: 'mock-image-audio-base64', mimeType: 'audio/wav' },
    systemPrompt: 'Use the supplied art direction.',
    cache: false,
  });

  assert(imageResponse.text === 'mock-image', 'mock Gemini image response is returned');
  assert(
    imageRequest?.config?.systemInstruction?.endsWith('Use the supplied art direction.'),
    'Gemini image generation receives the system instruction after the runtime context'
  );
  assert(
    imageRequest?.contents?.[0]?.parts?.[0]?.inlineData?.mimeType === 'audio/wav'
      && imageRequest?.contents?.[0]?.parts?.[0]?.inlineData?.data === 'mock-image-audio-base64',
    'Gemini image generation receives inline audio'
  );

  let audioRequest: any = null;
  runtime._client.models.generateContent = async (request: any) => {
    audioRequest = request;
    return {
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'heard it' }] } }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 },
    };
  };
  const audioResponse = await runtime.callModel({
    model: 'gemini-3.5-flash',
    prompt: 'What is in this recording?',
    audio: { data: 'mock-wav-base64', mimeType: 'audio/wav' },
    cache: false,
  });
  const audioParts = audioRequest?.contents?.[0]?.parts;
  assert(audioResponse.text === 'heard it', 'Gemini audio response is returned');
  assert(audioParts?.[0]?.inlineData?.mimeType === 'audio/wav', 'Gemini receives the audio MIME type');
  assert(audioParts?.[0]?.inlineData?.data === 'mock-wav-base64', 'Gemini receives base64 audio data');
  assert(audioParts?.[1]?.text === 'What is in this recording?', 'Gemini receives the audio prompt');

  const audioFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-audio-input-'));
  const audioFixturePath = path.join(audioFixtureDir, 'sample.wav');
  try {
    fs.writeFileSync(audioFixturePath, Buffer.from('mock-local-wav'));
    await runtime.callModel({
      model: 'gemini-3.5-flash',
      prompt: 'Inspect the local recording.',
      audio: audioFixturePath,
      cache: false,
    });
    const localAudio = audioRequest?.contents?.[0]?.parts?.[0]?.inlineData;
    assert(localAudio?.mimeType === 'audio/wav', 'local audio extension is mapped to a MIME type');
    assert(localAudio?.data === Buffer.from('mock-local-wav').toString('base64'), 'local audio is base64 encoded');
  } finally {
    fs.rmSync(audioFixtureDir, { recursive: true, force: true });
  }

  let omniRequest: any = null;
  runtime._client.interactions = {
    create: async (request: any) => {
      omniRequest = request;
      return { output_video: { type: 'video', data: 'mock-omni-video', mime_type: 'video/mp4' } };
    },
  };
  const omniVideo = await runtime.callVideo({
    model: 'gemini-omni-1.1-flash',
    prompt: 'Animate a marble run.',
    ratio: '9:16',
  });
  assert(omniVideo === 'mock-omni-video', 'Gemini Omni video data is returned');
  assert(omniRequest?.response_format?.aspect_ratio === '9:16', 'Omni receives the aspect ratio');

  let veoRequest: any = null;
  runtime._client.models.generateVideos = async (request: any) => {
    veoRequest = request;
    return {
      done: true,
      response: { generatedVideos: [{ video: { videoBytes: 'mock-veo-video', mimeType: 'video/mp4' } }] },
    };
  };
  const veoVideo = await runtime.callVideo({
    model: 'veo-3.1-generate-preview',
    prompt: 'A cinematic ocean shot.',
    duration: 8,
    resolution: '1080p',
  });
  assert(veoVideo === 'mock-veo-video', 'Veo video data is returned');
  assert(veoRequest?.source?.prompt === 'A cinematic ocean shot.', 'Veo uses the current source request shape');
  assert(veoRequest?.config?.durationSeconds === 8, 'Veo receives duration');
  assert(veoRequest?.config?.resolution === '1080p', 'Veo receives resolution');

  console.log('✓ Gemini text, image, Gemini Omni video, and Veo video requests are routed correctly');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
