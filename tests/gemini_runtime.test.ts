import { AIRuntime } from '../src/ai-runtime';

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
    requests[0]?.config?.systemInstruction === 'Follow this instruction exactly.',
    'Gemini receives the trimmed system instruction through generateContent config'
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
    streamedRequest?.config?.systemInstruction === 'Stream under these rules.',
    'Gemini streaming receives the system instruction'
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
    systemPrompt: 'Use the supplied art direction.',
    cache: false,
  });

  assert(imageResponse.text === 'mock-image', 'mock Gemini image response is returned');
  assert(
    imageRequest?.config?.systemInstruction === 'Use the supplied art direction.',
    'Gemini image generation receives the system instruction'
  );

  let omniRequest: any = null;
  runtime._client.interactions = {
    create: async (request: any) => {
      omniRequest = request;
      return { output_video: { type: 'video', data: 'mock-omni-video', mime_type: 'video/mp4' } };
    },
  };
  const omniVideo = await runtime.callVideo({
    model: 'gemini-omni-flash-preview',
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
