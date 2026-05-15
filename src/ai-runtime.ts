// AI Runtime - Integration with Gemini API
import { AIRequest, AIResponse, StructuredOutput } from './types';

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

  async callModel(request: AIRequest): Promise<AIResponse> {
    try {
      const client = this.client;
      
      // Inject current date/time for context
      const timeContext = `[System context: Current date and time is ${new Date().toUTCString()}]\n\n`;
      const fullPrompt = timeContext + request.prompt;

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

        const response = await client.models.generateContent({
          model: request.model,
          contents: request.prompt,
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
        
        return {
          text: base64String, // Return the base64 string directly
          finishReason: 'STOP',
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
        };
      }

      let accumulatedText = '';
      let currentFinishReason = '';
      let isComplete = false;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let maxPolls = 10;
      let currentPoll = 0;

      const contents: any[] = [
        { role: 'user', parts: [{ text: fullPrompt }] }
      ];

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
                    return {
                        text: JSON.stringify(part.call),
                        finishReason: 'TOOL_CALL',
                        usage: {
                            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
                            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
                        },
                    };
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

      return {
        text: accumulatedText,
        finishReason: currentFinishReason,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
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
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate against schema
        const result: StructuredOutput = {};
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
        return JSON.parse(jsonMatch2[0]);
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
