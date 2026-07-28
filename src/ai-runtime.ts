// AI Runtime - Integration with Gemini API
import { AIRequest, AIResponse, StructuredOutput, RuntimeValue } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

function stripPrototypes(val: any): any {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(stripPrototypes);
  }
  const cleanObj = Object.create(null);
  for (const key of Object.keys(val)) {
    cleanObj[key] = stripPrototypes(val[key]);
  }
  return cleanObj;
}

export class AIRuntime {
  private _client: any = null;
  private conversationHistory: Map<string, string[]> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();

  constructor() {}

  private isGPTModel(model: string): boolean {
    return /^gpt-/i.test(String(model || '').trim());
  }

  private mapThinkingEffort(thinkingLevel: AIRequest['thinkingLevel']): 'minimal' | 'low' | 'medium' | 'high' | undefined {
    if (!thinkingLevel) return undefined;

    let level = 'low';
    let thinking = true;

    if (typeof thinkingLevel === 'object' && thinkingLevel !== null) {
      thinking = (thinkingLevel as any).thinking !== 'no';
      level = String((thinkingLevel as any).level || 'low').toLowerCase();
    } else {
      level = String(thinkingLevel).toLowerCase();
      thinking = level !== 'no';
    }

    if (!thinking) return 'minimal';
    if (level === 'minimal' || level === 'low' || level === 'medium' || level === 'high') {
      return level;
    }
    return 'low';
  }

  private async postOpenAIJson(apiPath: string, body: Record<string, any>): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for GPT model calls.');
    }

    const payload = JSON.stringify(body);

    const responseText = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.openai.com',
          path: apiPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            const status = res.statusCode || 500;
            if (status >= 200 && status < 300) {
              resolve(data);
              return;
            }
            reject(new Error(`OpenAI API request failed (${status}): ${data}`));
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.write(payload);
      req.end();
    });

    try {
      return stripPrototypes(JSON.parse(responseText));
    } catch (e: any) {
      throw new Error(`Failed to parse OpenAI response JSON: ${e.message}`);
    }
  }

  private async postOpenAIResponses(body: Record<string, any>): Promise<any> {
    return await this.postOpenAIJson('/v1/responses', body);
  }

  private async streamOpenAIResponses(
    body: Record<string, any>,
    onDelta: (delta: string) => void | Promise<void>
  ): Promise<{ text: string; response: any }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for GPT model calls.');
    }

    const payload = JSON.stringify({ ...body, stream: true });

    return await new Promise<{ text: string; response: any }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.openai.com',
          path: '/v1/responses',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          const status = res.statusCode || 500;
          if (status < 200 || status >= 300) {
            let errBody = '';
            res.on('data', (chunk) => {
              errBody += String(chunk);
            });
            res.on('end', () => {
              reject(new Error(`OpenAI streaming request failed (${status}): ${errBody}`));
            });
            return;
          }

          let buffer = '';
          let text = '';
          let finalResponse: any = null;
          let deltaChain: Promise<void> = Promise.resolve();

          const consumeEvent = (rawEvent: string) => {
            const trimmed = rawEvent.trim();
            if (!trimmed) return;

            const lines = trimmed
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.startsWith('data:'));

            for (const line of lines) {
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;

              let event: any;
              try {
                event = stripPrototypes(JSON.parse(data));
              } catch {
                continue;
              }

              if (event?.type === 'response.error') {
                reject(new Error(event?.error?.message || 'OpenAI streaming error'));
                return;
              }

              if (event?.type === 'response.output_text.delta' && typeof event?.delta === 'string') {
                text += event.delta;
                deltaChain = deltaChain.then(async () => {
                  await onDelta(event.delta);
                });
                continue;
              }

              if (event?.type === 'response.completed' && event?.response) {
                finalResponse = event.response;
              }
            }
          };

          res.on('data', (chunk) => {
            buffer += chunk.toString('utf8');

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              consumeEvent(frame);
              boundary = buffer.indexOf('\n\n');
            }
          });

          res.on('end', () => {
            if (buffer.trim()) {
              consumeEvent(buffer);
            }

            deltaChain
              .then(() => {
                resolve({ text, response: finalResponse });
              })
              .catch(reject);
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }

  private extractOpenAIToolCall(response: any): { name: string; args: RuntimeValue; call_id?: string } | null {
    if (!Array.isArray(response?.output)) return null;

    for (const item of response.output) {
      if (item?.type !== 'function_call' || typeof item?.name !== 'string') continue;

      let parsedArgs: RuntimeValue = Object.create(null);
      const rawArgs = item?.arguments;

      if (typeof rawArgs === 'string' && rawArgs.trim() !== '') {
        try {
          parsedArgs = stripPrototypes(JSON.parse(rawArgs));
        } catch {
          parsedArgs = rawArgs;
        }
      }

      const toolCall: Record<string, RuntimeValue> = Object.create(null);
      toolCall.name = item.name;
      toolCall.args = parsedArgs;
      if (typeof item.call_id === 'string' && item.call_id.trim() !== '') {
        toolCall.call_id = item.call_id;
      }

      return toolCall as { name: string; args: RuntimeValue; call_id?: string };
    }

    return null;
  }

  private extractOpenAIText(response: any): string {
    if (typeof response?.output_text === 'string' && response.output_text.trim() !== '') {
      return response.output_text;
    }

    if (Array.isArray(response?.output)) {
      let text = '';
      for (const item of response.output) {
        if (!Array.isArray(item?.content)) continue;
        for (const part of item.content) {
          if (part?.type === 'output_text' && typeof part?.text === 'string') {
            text += part.text;
          }
        }
      }
      if (text.trim() !== '') {
        return text;
      }
    }

    return '';
  }

  private async callGPTModel(request: AIRequest): Promise<AIResponse> {
    if (request.images && request.images.length > 0) {
      throw new Error('GPT model calls currently support text-only prompts in Sesi.');
    }
    if (request.search) {
      throw new Error('search is currently not supported for GPT model calls in Sesi.');
    }
    const effort = this.mapThinkingEffort(request.thinkingLevel);
    const timeContext = `[System context: Current date and time is ${new Date().toUTCString()}]\n\n`;
    const fullPrompt = timeContext + request.prompt;

    const body: Record<string, any> = {
      model: request.model,
      input: fullPrompt,
    };

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_output_tokens = request.maxTokens;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (effort) body.reasoning = { effort };
    if (request.tools && request.tools.length > 0) body.tools = request.tools;

    if (request.stream) {
      const streamed = await this.streamOpenAIResponses(body, async (delta: string) => {
        if (typeof request.stream === 'function') {
          await request.stream(delta);
        } else if (request.stream === true) {
          process.stdout.write(delta);
        }
      });

      const toolCall = this.extractOpenAIToolCall(streamed.response);
      if (toolCall) {
        const usage = streamed.response?.usage || {};
        return {
          text: JSON.stringify(toolCall),
          finishReason: 'TOOL_CALL',
          usage: {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
          },
        };
      }

      const text = streamed.text.trim() !== ''
        ? streamed.text
        : this.extractOpenAIText(streamed.response);
      if (!text.trim()) {
        throw new Error('Returned no text output from GPT model.');
      }

      const finishReason = String(streamed.response?.status || 'completed').toUpperCase();
      const usage = streamed.response?.usage || {};
      return {
        text,
        finishReason,
        usage: {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        },
      };
    }

    const response = await this.postOpenAIResponses(body);
    const toolCall = this.extractOpenAIToolCall(response);
    if (toolCall) {
      const usage = response?.usage || {};
      return {
        text: JSON.stringify(toolCall),
        finishReason: 'TOOL_CALL',
        usage: {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        },
      };
    }

    const text = this.extractOpenAIText(response);
    if (!text.trim()) {
      throw new Error('Returned no text output from GPT model.');
    }

    const finishReason = String(response?.status || 'completed').toUpperCase();
    const usage = response?.usage || {};

    return {
      text,
      finishReason,
      usage: {
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
      },
    };
  }

  private normalizeModelName(model: string): string {
    const value = String(model || '').trim();
    if (!value) {
      return value;
    }

    if (value.startsWith('models/') || value.startsWith('projects/') || value.startsWith('publishers/')) {
      return value;
    }

    if (value.includes('/')) {
      return value;
    }

    return `models/${value}`;
  }

  private get client() {
    if (!this._client) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        this._client = new GoogleGenAI({});
      } catch (error: any) {
        throw new Error(
          'Failed to initialize Gemini SDK. Ensure @google/genai is installed ' +
          'and GEMINI_API_KEY environment variable is set.\nDetails: ' + error.message
        );
      }
    }
    return this._client;
  }

  async countTokens(model: string, contents: string): Promise<number> {
    const normalizedModel = String(model || '').trim();
    if (typeof contents !== 'string') {
      throw new Error('Native token counting requires string contents.');
    }

    if (this.isGPTModel(normalizedModel)) {
      try {
        const response = await this.postOpenAIJson('/v1/responses/input_tokens', {
          model: normalizedModel,
          input: contents,
        });
        const inputTokens = response?.input_tokens;
        if (typeof inputTokens !== 'number' || !Number.isFinite(inputTokens) || inputTokens < 0) {
          throw new Error('OpenAI input-token endpoint returned no valid input_tokens value.');
        }
        return Math.floor(inputTokens);
      } catch (error: any) {
        throw new Error(`Sesi: OpenAI token counting failed: ${error.message}`);
      }
    }

    if (!/^(?:models\/)?gemini-/i.test(normalizedModel)) {
      throw new Error('Native token counting requires a GPT or Gemini model name.');
    }

    try {
      const response = await this.client.models.countTokens({
        model: this.normalizeModelName(normalizedModel),
        contents,
      });
      const totalTokens = response?.totalTokens;
      if (typeof totalTokens !== 'number' || !Number.isFinite(totalTokens) || totalTokens < 0) {
        throw new Error('Gemini countTokens returned no valid totalTokens value.');
      }
      return Math.floor(totalTokens);
    } catch (error: any) {
      throw new Error(`Sesi: Gemini token counting failed: ${error.message}`);
    }
  }

  private getCacheFile(): string {
    return path.resolve(process.cwd(), '.sesi_cache.json');
  }

  private readCache(): Record<string, AIResponse> {
    const file = this.getCacheFile();
    if (fs.existsSync(file)) {
      try {
        return stripPrototypes(JSON.parse(fs.readFileSync(file, 'utf-8')));
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  private writeCache(cache: Record<string, AIResponse>): void {
    const file = this.getCacheFile();
    try {
      fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (e) {
      // Ignore write errors gracefully
    }
  }

  private computeCacheHash(request: AIRequest): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const input = {
      model: request.model,
      prompt: request.prompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      topK: request.topK,
      topP: request.topP,
      ratio: request.ratio,
      size: request.size,
      images: request.images,
      thinkingLevel: request.thinkingLevel,
      search: request.search,
    };
    hash.update(JSON.stringify(input));
    return hash.digest('hex');
  }

  private resolveImageParts(imagePaths: string[]): any[] {
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };

    const parts: any[] = [];
    for (const imgPath of imagePaths) {
      const abs = path.isAbsolute(imgPath) ? imgPath : path.resolve(process.cwd(), imgPath);
      const ext = path.extname(abs).toLowerCase();
      const mimeType = mimeMap[ext] ?? 'image/jpeg';
      const data = fs.readFileSync(abs).toString('base64');
      parts.push({ inlineData: { mimeType, data } });
    }
    return parts;
  }

  async synthesizeSpeech(text: string, voice: string = 'Vindemiatrix', model: string = 'gemini-2.5-flash-preview-tts'): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.normalizeModelName(model),
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (typeof part.inlineData?.data === 'string' && part.inlineData.data !== '') {
        const mimeType = part.inlineData.mimeType || 'audio/L16;rate=24000';
        const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');

        // Extract sample rate from mime type (e.g. "audio/L16;rate=24000")
        const rateMatch = mimeType.match(/rate=(\d+)/i);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = pcmBuffer.length;
        const wavHeader = Buffer.alloc(44);
        // RIFF chunk
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36 + dataSize, 4);
        wavHeader.write('WAVE', 8);
        // fmt sub-chunk
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16);           // sub-chunk size
        wavHeader.writeUInt16LE(1, 20);            // PCM = 1
        wavHeader.writeUInt16LE(numChannels, 22);
        wavHeader.writeUInt32LE(sampleRate, 24);
        wavHeader.writeUInt32LE(byteRate, 28);
        wavHeader.writeUInt16LE(blockAlign, 32);
        wavHeader.writeUInt16LE(bitsPerSample, 34);
        // data sub-chunk
        wavHeader.write('data', 36);
        wavHeader.writeUInt32LE(dataSize, 40);

        const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
        return wavBuffer.toString('base64');
      }
    }
    throw new Error('Speech generation returned no audio output.');
  }


  async transcribeSpeech(audioData: string, mimeType: string, language?: string, model: string = 'gemini-3.5-flash-lite'): Promise<string> {
    const languageInstruction = language && language.trim() !== ''
      ? ` The spoken language is ${language}; preserve it in the transcript.`
      : '';
    const response = await this.callModel({
      model,
      prompt: `Transcribe this audio accurately. Return only the transcript, without commentary, timestamps, or labels.${languageInstruction}`,
      cache: false,
      audio: { data: audioData, mimeType },
    });
    return response.text;
  }

  async callModel(request: AIRequest): Promise<AIResponse> {
    const useCache = request.cache !== false;
    let cacheHash = '';
    if (useCache) {
      cacheHash = this.computeCacheHash(request);
      const cache = this.readCache();
      if (cache[cacheHash]) {
        console.log('⚡ [Sesi Logic Cache] Served from local cache');
        const cachedRes = cache[cacheHash];
        if (request.stream) {
          if (typeof request.stream === 'function') {
            await request.stream(cachedRes.text);
          } else if (request.stream === true) {
            process.stdout.write(cachedRes.text);
          }
        }
        return {
          ...cachedRes,
          cached: true,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
          },
        };
      }
    }

    try {
      if (this.isGPTModel(request.model)) {
        const gptResponse = await this.callGPTModel(request);
        if (useCache) {
          const cache = this.readCache();
          cache[cacheHash] = gptResponse;
          this.writeCache(cache);
        }
        return gptResponse;
      }

      const client = this.client;
      const resolvedModel = this.normalizeModelName(request.model);
      
      // Inject current date/time for context
      const timeContext = `[System context: Current date and time is ${new Date().toUTCString()}]\n\n`;
      const fullPrompt = timeContext + request.prompt;

      // Build thinkingConfig if requested
      let thinkingConfig: any = undefined;
      if (request.thinkingLevel) {
        let level = 'low';
        let thinking = true;
        if (typeof request.thinkingLevel === 'object' && request.thinkingLevel !== null) {
          thinking = (request.thinkingLevel as any).thinking !== 'no';
          level = (request.thinkingLevel as any).level || 'low';
        } else if (typeof request.thinkingLevel === 'string') {
          level = request.thinkingLevel;
          thinking = level.toLowerCase() !== 'no';
        }

        const isGemini3 = request.model.includes('gemini-3');
        if (isGemini3) {
          const isPro = request.model.includes('pro');
          thinkingConfig = {
            thinkingLevel: thinking ? level.toLowerCase() : (isPro ? 'low' : 'minimal')
          };
        } else {
          thinkingConfig = {
            thinkingBudget: thinking ? (level === 'low' ? 1024 : level === 'medium' ? 2048 : 4096) : 0
          };
        }
      }

      // Handle image generation models dynamically
      if (request.model.includes('image')) {
        const imageConfig: any = {};
        if (request.ratio) imageConfig.aspectRatio = request.ratio;
        if (request.size) imageConfig.imageSize = request.size;

        const configObj: any = {
            responseModalities: ["IMAGE"]
        };
        
        if (Object.keys(imageConfig).length > 0) {
            configObj.imageConfig = imageConfig;
        }

        if (request.temperature !== undefined) configObj.temperature = request.temperature;
        if (request.maxTokens !== undefined) configObj.maxOutputTokens = request.maxTokens;
        if (request.topK !== undefined) configObj.topK = request.topK;
        if (request.topP !== undefined) configObj.topP = request.topP;
        if (thinkingConfig) configObj.thinkingConfig = thinkingConfig;

        const response = await client.models.generateContent({
          model: resolvedModel,
          contents: request.images && request.images.length > 0
            ? [{ role: 'user', parts: [...this.resolveImageParts(request.images), { text: request.prompt }] }]
            : request.prompt,
          config: configObj
        });
        
        let base64String = null;
        if (response.candidates && response.candidates.length > 0) {
           const candidate = response.candidates[0];
           if (candidate.finishReason && candidate.finishReason !== 'STOP') {
               throw new Error(`Image generation failed with finish reason: ${candidate.finishReason}`);
           }
           if (candidate.content && candidate.content.parts) {
               for (const part of candidate.content.parts) {
                   if (part.inlineData) {
                       base64String = part.inlineData.data;
                       break;
                   }
               }
           }
        }

        if (!base64String) {
          throw new Error("Image generation failed or returned no image output.");
        }
        
        const resObj: AIResponse = {
          text: base64String, // Return the base64 string directly
          finishReason: 'STOP',
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
        };

        if (useCache) {
          const cache = this.readCache();
          cache[cacheHash] = resObj;
          this.writeCache(cache);
        }

        return resObj;
      }

      let accumulatedText = '';
      let streamText = '';
      let currentFinishReason = '';
      let isComplete = false;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalThinkingTokens = 0;
      let maxPolls = 10;
      let currentPoll = 0;

      const contents: any[] = [];

      // Prepend image parts if provided
      const imageParts: any[] = request.images && request.images.length > 0
        ? this.resolveImageParts(request.images)
        : [];
      const audioParts: any[] = request.audio
        ? [{ inlineData: { mimeType: request.audio.mimeType, data: request.audio.data } }]
        : [];

      contents.push({
        role: 'user',
        parts: [...imageParts, ...audioParts, { text: fullPrompt }],
      });

      while (!isComplete && currentPoll < maxPolls) {
        const genConfig: any = {
            temperature: request.temperature ?? 0.3,
            maxOutputTokens: request.maxTokens ?? 8192,
            topK: request.topK,
            topP: request.topP,
        };

        if (request.tools) {
            genConfig.tools = request.tools;
        }

        if (request.search) {
            genConfig.tools = genConfig.tools || [];
            genConfig.tools.push({ googleSearch: {} });
        }

        if (thinkingConfig) {
          genConfig.thinkingConfig = thinkingConfig;
        }

        let response: any;
        if (request.stream) {
          const responseStream = await client.models.generateContentStream({
            model: resolvedModel,
            contents: contents,
            config: genConfig,
          });

          streamText = '';
          let lastCandidate: any = null;
          let usageMetadata: any = null;
          let toolCalls: any[] = [];

          for await (const chunk of responseStream) {
            const chunkText = chunk.text || '';
            if (chunkText) {
              streamText += chunkText;
              if (typeof request.stream === 'function') {
                await request.stream(chunkText);
              } else if (request.stream === true) {
                process.stdout.write(chunkText);
              }
            }
            const cand = chunk.candidates?.[0];
            if (cand) {
              lastCandidate = cand;
              if (cand.content?.parts) {
                for (const part of cand.content.parts) {
                  if (part.call) {
                    toolCalls.push(part.call);
                  }
                }
              }
            }
            if (chunk.usageMetadata) {
              usageMetadata = chunk.usageMetadata;
            }
          }

          if (toolCalls.length > 0 && lastCandidate) {
            lastCandidate.content = lastCandidate.content || {};
            lastCandidate.content.parts = lastCandidate.content.parts || [];
            for (const call of toolCalls) {
              if (!lastCandidate.content.parts.some((p: any) => p.call === call)) {
                lastCandidate.content.parts.push({ call });
              }
            }
          }

          const rawFinishReason = lastCandidate?.finishReason ?? 'STOP';
          const finishReason = String(rawFinishReason).toUpperCase();

          response = {
            candidates: lastCandidate ? [lastCandidate] : [],
            finishReason,
            usageMetadata,
          };
        } else {
          response = await client.models.generateContent({
            model: resolvedModel,
            contents: contents,
            config: genConfig,
          });
        }

        const candidate = response.candidates?.[0];
        const rawFinishReason = candidate?.finishReason ?? response.finishReason ?? 'UNKNOWN';
        const finishReason = String(rawFinishReason).toUpperCase();
        
        // Handle tool calls
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.call) {
                    const toolRes: AIResponse = {
                        text: JSON.stringify(part.call),
                        finishReason: 'TOOL_CALL',
                        usage: {
                            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
                            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
                            thinkingTokens: response.usageMetadata?.thoughtsTokenCount ?? 0,
                        },
                    };
                    return toolRes;
                }
            }
        }

        let text = '';
        if (request.stream) {
          text = streamText;
          accumulatedText += streamText;
        } else {
          if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                  if (part.text) {
                      text += part.text;
                  }
              }
          }
          accumulatedText += text;
        }

        totalInputTokens += response.usageMetadata?.promptTokenCount ?? 0;
        totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;
        totalThinkingTokens += response.usageMetadata?.thoughtsTokenCount ?? 0;

        currentFinishReason = finishReason;

        if (finishReason === 'MAX_TOKENS') {
          // Add the model's partial response to the history and prompt it to continue
          contents.push({ role: 'model', parts: [{ text: text }] });
          contents.push({ role: 'user', parts: [{ text: 'Please continue exactly where you left off.' }] });
          currentPoll++;
        } else if (finishReason === 'STOP') {
          isComplete = true;
        } else {
          if (!accumulatedText.trim()) {
            throw new Error(`Returned no text output (finish reason: ${finishReason})`);
          }
          isComplete = true;
        }
      }

      if (currentFinishReason !== 'STOP' && currentFinishReason !== 'MAX_TOKENS') {
        throw new Error(`Generation did not complete successfully (finish reason: ${currentFinishReason})`);
      }

      const resObj: AIResponse = {
        text: accumulatedText,
        finishReason: currentFinishReason,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          thinkingTokens: totalThinkingTokens,
        },
      };

      if (useCache) {
        const cache = this.readCache();
        cache[cacheHash] = resObj;
        this.writeCache(cache);
      }

      return resObj;
    } catch (error: any) {
      throw new Error(`Sesi: ${error.message}`);
    }
  }

  async parseStructuredOutput(
    response: string,
    schema: Record<string, any>
  ): Promise<StructuredOutput> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = stripPrototypes(JSON.parse(jsonMatch[0]));
        // Validate against schema
        const result: StructuredOutput = Object.create(null);
        for (const [key] of Object.entries(schema)) {
          result[key] = parsed[key];
        }
        return result;
      }

      // If no JSON found, try to prompt model for structured output
      const structuredPrompt = `Convert this response to JSON matching this schema:\n${JSON.stringify(schema)}\n\nResponse: ${response}`;
      const structuredResponse = await this.callModel({
        model: 'gemini-3.5-flash-lite',
        prompt: structuredPrompt,
        temperature: 0,
      });

      const jsonMatch2 = structuredResponse.text.match(/\{[\s\S]*\}/);
      if (jsonMatch2) {
        return stripPrototypes(JSON.parse(jsonMatch2[0]));
      }

      throw new Error('Could not parse structured output');
    } catch (error: any) {
      console.error('Error parsing structured output:', error.message);
      return {};
    }
  }

  initializeMemory(memoryId: string, initialValue: string): void {
    this.conversationHistory.set(memoryId, [initialValue]);
  }

  appendToMemory(memoryId: string, content: string): void {
    if (!this.conversationHistory.has(memoryId)) {
      this.conversationHistory.set(memoryId, []);
    }
    this.conversationHistory.get(memoryId)!.push(content);
  }

  getMemory(memoryId: string): string {
    const history = this.conversationHistory.get(memoryId);
    if (!history) return '';
    return history.join('\n');
  }

  updateMemory(memoryId: string, content: string): void {
    this.conversationHistory.set(memoryId, [content]);
  }

  estimateTokens(text: string): number {
    // Heuristic: ~4 characters per token for English text.
    // Avoids an API call and is accurate enough for context window budgeting.
    return Math.ceil(text.length / 4);
  }

  async embedText(text: string): Promise<number[]> {
    const crypto = require('crypto');
    const cacheKey = crypto.createHash('sha256').update(text).digest('hex');
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    const client = this.client;
    const models = ['gemini-embedding-001', 'gemini-embedding-2'];
    let lastError: Error | null = null;

    for (const model of models) {
      try {
        const response = await client.models.embedContent({
          model: this.normalizeModelName(model),
          contents: text,
        });
        const embedding: number[] = response.embeddings?.[0]?.values
          ?? response.embedding?.values
          ?? [];
        if (embedding.length > 0) {
          this.embeddingCache.set(cacheKey, embedding);
          return embedding;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw new Error(
      'Failed to generate embedding with both gemini-embedding-001 and gemini-embedding-2.' +
      (lastError ? ` Last error: ${lastError.message}` : '')
    );
  }

  async searchMemory(
    memoryId: string,
    query: string,
    topK: number = 3,
  ): Promise<Array<{ text: string; score: number }>> {
    const history = this.conversationHistory.get(memoryId);
    if (!history || history.length === 0) return [];

    // Embed the query
    const queryVec = await this.embedText(query);

    // Embed each memory chunk and compute cosine similarity
    const scored: Array<{ text: string; score: number }> = [];
    for (const chunk of history) {
      if (!chunk.trim()) continue;
      const chunkVec = await this.embedText(chunk);
      const score = cosineSimilarity(queryVec, chunkVec);
      scored.push({ text: chunk, score });
    }

    // Sort descending by score and return top-K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(item => {
      const obj: any = Object.create(null);
      obj.text = item.text;
      obj.score = Math.round(item.score * 10000) / 10000;
      return obj;
    });
  }

  async trimMemory(memoryId: string, maxTokens: number = 900000): Promise<string> {
    const history = this.conversationHistory.get(memoryId);
    if (!history || history.length === 0) return '';

    const fullText = history.join('\n');
    const currentTokens = this.estimateTokens(fullText);

    if (currentTokens <= maxTokens) {
      return fullText;
    }

    // Keep the most recent entries (roughly half), summarize the older half
    const midpoint = Math.floor(history.length / 2);
    const oldEntries = history.slice(0, midpoint);
    const recentEntries = history.slice(midpoint);

    const oldText = oldEntries.join('\n');

    // Summarize old entries using a fast model
    let summary: string;
    try {
      const response = await this.callModel({
        model: 'gemini-3.5-flash-lite',
        prompt: `Summarize the following conversation history into a concise paragraph that preserves all key facts, decisions, and context. Do not add commentary.\n\n${oldText}`,
        temperature: 0,
        cache: false,
      });
      summary = response.text.trim();
    } catch (err: any) {
      // If summarization fails, just truncate to the recent half
      summary = `[Summary of ${oldEntries.length} earlier entries — summarization unavailable]`;
    }

    // Replace history with summarized older part + recent entries
    const newHistory = [`[Memory Summary]\n${summary}`, ...recentEntries];
    this.conversationHistory.set(memoryId, newHistory);
    const result = newHistory.join('\n');
    return result;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export const aiRuntime = new AIRuntime();
