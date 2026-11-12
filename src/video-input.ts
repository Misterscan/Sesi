import { type AIVideoInput } from './types';

/** Normalize video configuration while allowing each execution engine to enforce file access. */
export function normalizeVideoInputs(value: unknown, resolvePath?: (source: string) => string): AIVideoInput[] | undefined {
  if (value === undefined || value === null) return undefined;
  const inputs = Array.isArray(value) ? value : [value];
  return inputs.map((input): AIVideoInput => {
    if (typeof input === 'string' && input.trim()) {
      const source = input.trim();
      if (/^(?:https?:\/\/|data:)/i.test(source)) return source;
      return resolvePath ? resolvePath(source) : source;
    }
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const mimeType = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : undefined;
      if (mimeType !== undefined && !/^video\/[a-z0-9.+-]+$/i.test(mimeType)) {
        throw new Error('Video input requires a valid video MIME type.');
      }
      if (typeof input.data === 'string' && input.data.trim() && mimeType && input.uri === undefined) {
        if (!/^[a-z0-9+/\s]+={0,2}$/i.test(input.data.trim())) throw new Error('Video input data must be base64 encoded.');
        return { data: input.data.trim(), mimeType };
      }
      if (typeof input.uri === 'string' && /^https?:\/\//i.test(input.uri.trim()) && input.data === undefined) {
        return { uri: input.uri.trim(), ...(mimeType ? { mimeType } : {}) };
      }
    }
    throw new Error('Video input must be a non-empty file path, HTTP(S) URL, video data URL, {data, mimeType}, or {uri, mimeType?}.');
  });
}
