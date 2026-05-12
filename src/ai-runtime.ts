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
      const response = await client.models.generateContent({
        model: request.model,
        contents: request.prompt,
        config: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens ?? 2048,
          topK: request.topK,
          topP: request.topP,
        },
      });

      const candidate = response.candidates?.[0];
      const rawFinishReason = candidate?.finishReason ?? response.finishReason ?? 'UNKNOWN';
      const finishReason = String(rawFinishReason).toUpperCase();
      const text = typeof response.text === 'string' ? response.text : '';

      if (!text.trim()) {
        throw new Error(`Returned no text output (finish reason: ${finishReason})`);
      }

      if (finishReason !== 'STOP') {
        throw new Error(`Generation did not complete successfully (finish reason: ${finishReason})`);
      }

      return {
        text,
        finishReason,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
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
