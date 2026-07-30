// AI Runtime - local, Gemini, and OpenAI model providers
import { AIRequest, AIResponse, StructuredOutput, RuntimeValue } from './types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const DEFAULT_LOCAL_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
export const DEFAULT_LOCAL_MODEL_WARNING_TOKENS = 2048;

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
  private _openAIClient: any = null;
  private localPipelines: Map<string, Promise<any>> = new Map();
  private localTokenizers: Map<string, Promise<any>> = new Map();
  private conversationHistory: Map<string, string[]> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();

  constructor() {}

  private isGPTModel(model: string): boolean {
    return /^gpt-/i.test(String(model || '').trim());
  }

  private isGPTImageModel(model: string): boolean {
    const normalized = String(model || '').trim();
    return this.isGPTModel(normalized) && /image/i.test(normalized);
  }

  private isLocalModel(model: string): boolean {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'local' || normalized.startsWith('local:');
  }

  private resolveLocalModelName(model: string): string {
    const normalized = String(model || '').trim();
    let resolved: string;
    if (normalized.toLowerCase().startsWith('local:')) {
      const explicitModel = normalized.slice(normalized.indexOf(':') + 1).trim();
      if (!explicitModel) {
        throw new Error('A local model name after "local:" is required.');
      }
      resolved = explicitModel;
    } else {
      resolved = process.env.SESI_LOCAL_MODEL?.trim() || DEFAULT_LOCAL_MODEL;
    }

    const segments = resolved.split('/');
    if (
      segments.length !== 2
      || segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === '.' || segment === '..')
    ) {
      throw new Error(
        `Invalid local model ID "${resolved}". Expected a Hugging Face ID such as "organization/model".`
      );
    }
    return resolved;
  }

  private getLocalCacheDirectory(): string {
    const configured = process.env.SESI_LOCAL_CACHE_DIR?.trim();
    return configured
      ? path.resolve(configured)
      : path.join(os.homedir(), '.cache', 'sesi', 'models');
  }

  private isLocalModelCached(modelName: string, dtype?: string): boolean {
    const modelDirectory = this.getLocalModelDirectory(modelName);
    if (!fs.existsSync(path.join(modelDirectory, 'config.json'))) {
      return false;
    }
    if (!dtype) {
      return fs.existsSync(path.join(modelDirectory, 'tokenizer.json'));
    }

    const modelFile = dtype === 'fp32'
      ? 'model.onnx'
      : `model_${dtype}.onnx`;
    return fs.existsSync(path.join(modelDirectory, 'onnx', modelFile));
  }

  private getLocalModelDirectory(modelName: string): string {
    return path.join(this.getLocalCacheDirectory(), ...modelName.split('/'));
  }

  private async getLocalPipeline(modelName: string): Promise<any> {
    const dtype = process.env.SESI_LOCAL_DTYPE?.trim() || 'q4';
    const device = process.env.SESI_LOCAL_DEVICE?.trim() || 'cpu';
    const cacheDirectory = this.getLocalCacheDirectory();
    const cacheKey = `${modelName}\0${dtype}\0${device}\0${cacheDirectory}`;
    let pending = this.localPipelines.get(cacheKey);

    if (!pending) {
      pending = (async () => {
        let transformers: any;
        try {
          transformers = require('@huggingface/transformers');
        } catch (error: any) {
          throw new Error(
            'Local model support is unavailable. Reinstall Sesi so the bundled ' +
            `Transformers.js runtime is present. Details: ${error.message}`
          );
        }

        const cached = this.isLocalModelCached(modelName, dtype);
        const modelSource = cached ? this.getLocalModelDirectory(modelName) : modelName;
        return await transformers.pipeline('text-generation', modelSource, {
          dtype,
          device,
          cache_dir: cacheDirectory,
          local_files_only: cached,
        });
      })();

      this.localPipelines.set(cacheKey, pending);
      pending.catch(() => {
        this.localPipelines.delete(cacheKey);
      });
    }

    return await pending;
  }

  private async getLocalTokenizer(modelName: string): Promise<any> {
    const cacheDirectory = this.getLocalCacheDirectory();
    const cacheKey = `${modelName}\0${cacheDirectory}`;
    let pending = this.localTokenizers.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        let transformers: any;
        try {
          transformers = require('@huggingface/transformers');
        } catch (error: any) {
          throw new Error(
            'Local tokenization is unavailable because Transformers.js is not installed. ' +
            `Details: ${error.message}`
          );
        }
        const cached = this.isLocalModelCached(modelName);
        const modelSource = cached ? this.getLocalModelDirectory(modelName) : modelName;
        return await transformers.AutoTokenizer.from_pretrained(modelSource, {
          cache_dir: cacheDirectory,
          local_files_only: cached,
        });
      })();
      this.localTokenizers.set(cacheKey, pending);
      pending.catch(() => {
        this.localTokenizers.delete(cacheKey);
      });
    }
    return await pending;
  }

  private countEncodedTokens(tokenizer: any, text: string): number {
    try {
      const encoded = tokenizer.encode(text);
      if (Array.isArray(encoded)) return encoded.length;
      if (encoded && typeof encoded.length === 'number') return encoded.length;
      if (encoded?.input_ids && typeof encoded.input_ids.length === 'number') {
        return encoded.input_ids.length;
      }
    } catch {
      // Fall through to Sesi's local estimate.
    }
    return this.estimateTokens(text);
  }

  private getLocalWarningThreshold(): number {
    const configured = process.env.SESI_LOCAL_WARN_TOKENS?.trim();
    if (configured !== undefined && configured !== '') {
      const parsed = Number(configured);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
    return DEFAULT_LOCAL_MODEL_WARNING_TOKENS;
  }

  private extractLocalText(output: any): string {
    const generated = Array.isArray(output)
      ? output[0]?.generated_text
      : output?.generated_text;

    if (typeof generated === 'string') {
      return generated;
    }

    if (Array.isArray(generated)) {
      for (let i = generated.length - 1; i >= 0; i--) {
        const message = generated[i];
        if (message?.role === 'assistant' && typeof message?.content === 'string') {
          return message.content;
        }
      }
    }

    return '';
  }

  private async callLocalModel(request: AIRequest): Promise<AIResponse> {
    if (request.images?.length) {
      throw new Error('Local model calls currently support text-only prompts.');
    }
    if (request.audio) {
      throw new Error('Local model calls currently do not support audio input.');
    }
    if (request.search) {
      throw new Error('search is not available for local model calls.');
    }
    if (request.tools?.length) {
      throw new Error('Tool calling is not yet available for local model calls.');
    }

    const modelName = this.resolveLocalModelName(request.model);
    const generator = await this.getLocalPipeline(modelName);
    const systemPrompt = request.systemPrompt?.trim()
      || process.env.SESI_LOCAL_SYSTEM_PROMPT?.trim()
      || 'You are an experienced conversationalist and code assistant. Follow the user request exactly.';
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: request.prompt },
    ];
    const tokenizer = generator.tokenizer;
    const inputTokens = this.countEncodedTokens(tokenizer, `${systemPrompt}\n${request.prompt}`);
    const warningThreshold = this.getLocalWarningThreshold();
    if (warningThreshold > 0 && inputTokens > warningThreshold) {
      console.warn(
        `⚠️ [Sesi Local Model] Input is ${inputTokens.toLocaleString()} tokens; ` +
        `the recommended CPU threshold is ${warningThreshold.toLocaleString()}. ` +
        'Inference may take several minutes. Configure SESI_LOCAL_WARN_TOKENS or set it to 0 to disable this warning.'
      );
    }

    const generationOptions: Record<string, any> = {
      max_new_tokens: request.maxTokens ?? 512,
      do_sample: request.temperature !== undefined && request.temperature > 0,
    };
    if (request.temperature !== undefined && request.temperature > 0) {
      generationOptions.temperature = request.temperature;
    }
    if (request.topK !== undefined) generationOptions.top_k = request.topK;
    if (request.topP !== undefined) generationOptions.top_p = request.topP;

    let streamedText = '';
    let streamChain: Promise<void> = Promise.resolve();
    if (request.stream) {
      const { TextStreamer } = require('@huggingface/transformers');
      generationOptions.streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (delta: string) => {
          streamedText += delta;
          streamChain = streamChain.then(async () => {
            if (typeof request.stream === 'function') {
              await request.stream(delta);
            } else {
              process.stdout.write(delta);
            }
          });
        },
      });
    }

    const output = await generator(messages, generationOptions);
    await streamChain;
    const text = streamedText || this.extractLocalText(output);
    if (!text.trim()) {
      throw new Error(`Local model "${modelName}" returned no text output.`);
    }

    return {
      text,
      finishReason: 'STOP',
      usage: {
        inputTokens,
        outputTokens: this.countEncodedTokens(tokenizer, text),
        thinkingTokens: 0,
      },
    };
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

  private get openAIClient(): any {
    if (this._openAIClient) {
      return this._openAIClient;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for GPT model calls.');
    }

    try {
      const OpenAI = require('openai').default;
      this._openAIClient = new OpenAI({ apiKey });
      return this._openAIClient;
    } catch (error: any) {
      throw new Error(
        'Failed to initialize OpenAI SDK. Ensure the openai package is installed. ' +
        `Details: ${error.message}`
      );
    }
  }

  private async postOpenAIResponses(body: Record<string, any>): Promise<any> {
    return stripPrototypes(await this.openAIClient.responses.create(body));
  }

  private async streamOpenAIResponses(
    body: Record<string, any>,
    onDelta: (delta: string) => void | Promise<void>
  ): Promise<{ text: string; response: any }> {
    const stream = await this.openAIClient.responses.create({ ...body, stream: true });
    let text = '';
    let finalResponse: any = null;

    for await (const event of stream) {
      if (event?.type === 'response.output_text.delta' && typeof event?.delta === 'string') {
        text += event.delta;
        await onDelta(event.delta);
      } else if (event?.type === 'response.completed' && event?.response) {
        finalResponse = stripPrototypes(event.response);
      } else if (event?.type === 'error') {
        throw new Error(event?.message || 'OpenAI streaming error');
      }
    }

    return { text, response: finalResponse };
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

  private normalizeOpenAITools(tools: any[]): any[] {
    return tools.map((tool) => {
      if (tool?.type !== 'function' || !tool.function || typeof tool.function !== 'object') {
        return tool;
      }

      return {
        type: 'function',
        ...tool.function,
      };
    });
  }

  private resolveOpenAIImageParts(imagePaths: string[]): any[] {
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };

    return imagePaths.map((imagePath) => {
      const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(process.cwd(), imagePath);
      const mimeType = mimeMap[path.extname(absolutePath).toLowerCase()] ?? 'image/jpeg';
      const data = fs.readFileSync(absolutePath).toString('base64');
      return {
        type: 'input_image',
        image_url: `data:${mimeType};base64,${data}`,
        detail: 'auto',
      };
    });
  }


  private resolveOpenAIImageSize(size?: string, ratio?: string): string {
    const normalizedSize = String(size || '').trim().toLowerCase();
    const supportedSizes = new Set(['1024x1024', '1536x1024', '1024x1536']);
    if (supportedSizes.has(normalizedSize)) {
      return normalizedSize;
    }

    const normalizedRatio = String(ratio || '').trim();
    const ratioMap: Record<string, string> = {
      '1:1': '1024x1024',
      '4:3': '1536x1024',
      '16:9': '1536x1024',
      '3:4': '1024x1536',
      '9:16': '1024x1536',
    };

    return ratioMap[normalizedRatio] ?? '1024x1024';
  }

  private async callGPTImageModel(request: AIRequest): Promise<AIResponse> {
    if (request.audio) {
      throw new Error('GPT image model calls do not yet support Sesi audio input.');
    }
    if (request.images?.length) {
      throw new Error('GPT image model calls do not yet support reference image input.');
    }
    if (request.tools?.length) {
      throw new Error('GPT image model calls do not yet support tools.');
    }
    if (request.search) {
      throw new Error('GPT image model calls do not yet support web search.');
    }
    if (request.stream) {
      throw new Error('GPT image model calls do not support streaming.');
    }

    const imagesApi = this.openAIClient?.images;
    if (!imagesApi || typeof imagesApi.generate !== 'function') {
      throw new Error('OpenAI image generation is unavailable. Ensure the openai package is installed and supports images.generate().');
    }

    const body: Record<string, any> = {
      model: request.model,
      prompt: request.prompt,
    };

    const size = this.resolveOpenAIImageSize(request.size, request.ratio);
    if (size) {
      body.size = size;
    }

    const response = await imagesApi.generate(body);
    const firstImage = response?.data?.[0] ?? null;
    let base64String = firstImage?.b64_json ?? firstImage?.base64 ?? firstImage?.image_base64 ?? null;

    if (!base64String && typeof firstImage?.url === 'string' && firstImage.url.trim() !== '') {
      const remote = await fetch(firstImage.url);
      if (!remote.ok) {
        throw new Error(`GPT image generation returned a URL that could not be fetched: ${remote.status} ${remote.statusText}`);
      }
      base64String = Buffer.from(await remote.arrayBuffer()).toString('base64');
    }

    if (!base64String) {
      throw new Error('GPT image generation failed or returned no image output.');
    }

    return {
      text: base64String,
      finishReason: 'STOP',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }
  private async callGPTModel(request: AIRequest): Promise<AIResponse> {
    if (request.audio) {
      throw new Error('GPT model calls do not yet support Sesi audio input. Use a Gemini model for audio transcription.');
    }
    const effort = this.mapThinkingEffort(request.thinkingLevel);
    const timeContext = `[System context: Current date and time is ${new Date().toUTCString()}]\n\n`;
    const instructions = request.systemPrompt?.trim()
      ? `${timeContext}${request.systemPrompt.trim()}`
      : timeContext.trim();
    const input = request.images?.length
      ? [{
        role: 'user',
        content: [
          ...this.resolveOpenAIImageParts(request.images),
          { type: 'input_text', text: request.prompt },
        ],
      }]
      : request.prompt;

    const body: Record<string, any> = {
      model: request.model,
      input,
      instructions,
    };

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_output_tokens = request.maxTokens;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (effort) body.reasoning = { effort };
    if (request.tools && request.tools.length > 0) body.tools = this.normalizeOpenAITools(request.tools);
    if (request.search) body.tools = [...(body.tools ?? []), { type: 'web_search' }];

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

    if (this.isLocalModel(normalizedModel)) {
      try {
        const tokenizer = await this.getLocalTokenizer(this.resolveLocalModelName(normalizedModel));
        return this.countEncodedTokens(tokenizer, contents);
      } catch (error: any) {
        throw new Error(`Sesi: Local token counting failed: ${error.message}`);
      }
    }

    if (this.isGPTModel(normalizedModel)) {
      try {
        const response = await this.openAIClient.responses.inputTokens.count({
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
      resolvedLocalModel: this.isLocalModel(request.model)
        ? this.resolveLocalModelName(request.model)
        : undefined,
      localDtype: this.isLocalModel(request.model)
        ? process.env.SESI_LOCAL_DTYPE || 'q4'
        : undefined,
      localDevice: this.isLocalModel(request.model)
        ? process.env.SESI_LOCAL_DEVICE || 'cpu'
        : undefined,
      localSystemPrompt: this.isLocalModel(request.model)
        ? request.systemPrompt?.trim()
          || process.env.SESI_LOCAL_SYSTEM_PROMPT?.trim()
          || 'You are an experienced conversationalist and code assistant. Follow the user request exactly.'
        : undefined,
      prompt: request.prompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      topK: request.topK,
      topP: request.topP,
      ratio: request.ratio,
      size: request.size,
      images: request.images,
      systemPrompt: request.systemPrompt,
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
      if (this.isLocalModel(request.model)) {
        const localResponse = await this.callLocalModel(request);
        if (useCache) {
          const cache = this.readCache();
          cache[cacheHash] = localResponse;
          this.writeCache(cache);
        }
        return localResponse;
      }

      if (this.isGPTModel(request.model)) {
        const gptResponse = this.isGPTImageModel(request.model)
          ? await this.callGPTImageModel(request)
          : await this.callGPTModel(request);
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
