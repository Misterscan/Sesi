// AI Runtime - Integration with Gemini API
import { AIRequest, AIResponse, StructuredOutput } from './types';
import * as fs from 'fs';
import * as path from 'path';

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

  constructor() {}

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

  async callModel(request: AIRequest): Promise<AIResponse> {
    const useCache = request.cache !== false;
    let cacheHash = '';
    if (useCache) {
      cacheHash = this.computeCacheHash(request);
      const cache = this.readCache();
      if (cache[cacheHash]) {
        console.log('⚡ [Sesi Logic Cache] Served from local cache');
        return cache[cacheHash];
      }
    }

    try {
      const client = this.client;
      
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
          model: request.model,
          contents: request.images && request.images.length > 0
            ? [{ role: 'user', parts: [...this.resolveImageParts(request.images), { text: request.prompt }] }]
            : request.prompt,
          config: configObj
        });
        
        let base64String = null;
        if (response.candidates && response.candidates.length > 0) {
           for (const part of response.candidates[0].content.parts) {
               if (part.inlineData) {
                   base64String = part.inlineData.data;
                   break;
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
      let currentFinishReason = '';
      let isComplete = false;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let maxPolls = 10;
      let currentPoll = 0;

      const contents: any[] = [];

      // Prepend image parts if provided
      const imageParts: any[] = request.images && request.images.length > 0
        ? this.resolveImageParts(request.images)
        : [];

      contents.push({
        role: 'user',
        parts: [...imageParts, { text: fullPrompt }],
      });

      while (!isComplete && currentPoll < maxPolls) {
        const genConfig: any = {
            temperature: request.temperature ?? 0.3,
            maxOutputTokens: request.maxTokens ?? 2048,
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

        const response = await client.models.generateContent({
          model: request.model,
          contents: contents,
          config: genConfig,
        });

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
                        },
                    };
                    return toolRes;
                }
            }
        }

        let text = '';
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.text) {
                    text += part.text;
                }
            }
        }
        accumulatedText += text;

        totalInputTokens += response.usageMetadata?.promptTokenCount ?? 0;
        totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;

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
        model: 'gemini-3.1-flash-lite',
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
}

export const aiRuntime = new AIRuntime();
