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

  console.log('✓ Gemini system instructions are forwarded for standard, streaming, and image requests');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
