export interface TokenRates {
  inputPerMillion: number;
  imageInputPerMillion?: number;
  outputPerMillion: number;
  source: string;
  asOf: string;
}

export interface TokenCostEstimate extends TokenRates {
  model: string;
  inputTokens: number;
  imageInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

interface PricingRule {
  models: string[];
  standard: Omit<TokenRates, 'source' | 'asOf'>;
  longContext?: {
    aboveInputTokens: number;
    rates: Omit<TokenRates, 'source' | 'asOf'>;
  };
  source: string;
}

const PRICING_AS_OF = '2026-11-17';
const GEMINI_PRICING_SOURCE = 'https://ai.google.dev/gemini-api/docs/pricing';
const OPENAI_PRICING_SOURCE = 'https://developers.openai.com/api/docs/pricing';

// Standard, paid-tier token rates in USD per one million tokens.
// Multimodal models use their listed input and generated-media output rates.
// These rates do not include cached input, tool fees, or provider processing
// tiers beyond Standard.
// Keep longer/more-specific model names before their family prefixes.
const PRICING_RULES: PricingRule[] = [
  {
    models: ['gemini-nano-banana-2.1'],
    standard: { inputPerMillion: 1.5, outputPerMillion: 30 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.1-flash-lite-image'],
    standard: { inputPerMillion: 0.25, outputPerMillion: 30 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.1-flash-image'],
    standard: { inputPerMillion: 0.5, outputPerMillion: 60 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3-pro-image'],
    standard: { inputPerMillion: 2, outputPerMillion: 120 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-2.5-flash-image'],
    standard: { inputPerMillion: 0.3, outputPerMillion: 30 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-4-hydrogen'],
    standard: { inputPerMillion: 1.50, outputPerMillion: 7.50 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-4-argon', 'gemini-4-carbon'],
    standard: { inputPerMillion: 2, outputPerMillion: 10 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.8-flash'],
    standard: { inputPerMillion: 0.75, outputPerMillion: 3.75 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.6-flash'],
    standard: { inputPerMillion: 0.75, outputPerMillion: 3.75 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3-flash-preview'],
    standard: { inputPerMillion: 0.5, outputPerMillion: 3 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-omni-1.1-flash'],
    standard: { inputPerMillion: 1.5, outputPerMillion: 17.5 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.8-flash-tts'],
    standard: { inputPerMillion: 0.5, outputPerMillion: 9 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.8-flash-lite-tts'],
    standard: { inputPerMillion: 0.5, outputPerMillion: 6 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.5-transcribe'],
    standard: { inputPerMillion: 2, outputPerMillion: 12 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.5-transcribe-live'],
    standard: { inputPerMillion: 3.5, outputPerMillion: 21 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-robotics-er-2-preview', 'gemini-robotics-er-2-streaming-preview'],
    standard: { inputPerMillion: 1, outputPerMillion: 5 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.5-flash-lite'],
    standard: { inputPerMillion: 0.3, outputPerMillion: 2.5 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.1-flash-lite'],
    standard: { inputPerMillion: 0.25, outputPerMillion: 1.5 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.1-pro-preview-customtools', 'gemini-3.1-pro-preview'],
    standard: { inputPerMillion: 2, outputPerMillion: 12 },
    longContext: {
      aboveInputTokens: 200_000,
      rates: { inputPerMillion: 4, outputPerMillion: 18 },
    },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-2.5-flash-lite'],
    standard: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-2.5-flash'],
    standard: { inputPerMillion: 0.3, outputPerMillion: 2.5 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-2.5-pro'],
    standard: { inputPerMillion: 1.25, outputPerMillion: 10 },
    longContext: {
      aboveInputTokens: 200_000,
      rates: { inputPerMillion: 2.5, outputPerMillion: 15 },
    },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'],
    standard: { inputPerMillion: 5, imageInputPerMillion: 8, outputPerMillion: 30 },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-6.2-astra'],
    standard: { inputPerMillion: 8, outputPerMillion: 40 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 16, outputPerMillion: 60 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-6-astra'],
    standard: { inputPerMillion: 10, outputPerMillion: 50 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 20, outputPerMillion: 75 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-6-sol', 'gpt-6.1-sol', 'gpt-6.2-sol'],
    standard: { inputPerMillion: 2, outputPerMillion: 10 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 4, outputPerMillion: 15 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-6.1-terra'],
    standard: { inputPerMillion: 1, outputPerMillion: 5 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 2, outputPerMillion: 7.5 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-6-luna'],
    standard: { inputPerMillion: 0.1, outputPerMillion: 0.5 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 0.2, outputPerMillion: 0.75 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.6-sol', 'gpt-5.6'],
    standard: { inputPerMillion: 4, outputPerMillion: 20 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 8, outputPerMillion: 30 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.6-terra'],
    standard: { inputPerMillion: 2, outputPerMillion: 12 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 4, outputPerMillion: 18 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.6-luna'],
    standard: { inputPerMillion: 0.2, outputPerMillion: 1.2 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 0.4, outputPerMillion: 1.8 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.5-pro'],
    standard: { inputPerMillion: 30, outputPerMillion: 180 },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.4-pro'],
    standard: { inputPerMillion: 30, outputPerMillion: 180 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 60, outputPerMillion: 270 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.5'],
    standard: { inputPerMillion: 5, outputPerMillion: 30 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 10, outputPerMillion: 45 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.4-mini'],
    standard: { inputPerMillion: 0.75, outputPerMillion: 4.5 },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.4'],
    standard: { inputPerMillion: 2.5, outputPerMillion: 15 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 5, outputPerMillion: 22.5 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.2'],
    standard: { inputPerMillion: 1.75, outputPerMillion: 14 },
    source: OPENAI_PRICING_SOURCE,
  },
];

function normalizeModelName(model: string): string {
  return String(model || '')
    .trim()
    .toLowerCase()
    .replace(/^models\//, '');
}

function matchesModel(model: string, candidate: string): boolean {
  if (model === candidate) return true;
  if (!model.startsWith(`${candidate}-`)) return false;
  const suffix = model.slice(candidate.length + 1);
  // Match dated snapshots, but not deprecated preview IDs or distinct tiers.
  return /^20\d{2}-\d{2}-\d{2}$/.test(suffix);
}

export function resolveTokenRates(modelName: string, inputTokens: number): TokenRates | null {
  const model = normalizeModelName(modelName);
  for (const rule of PRICING_RULES) {
    if (!rule.models.some(candidate => matchesModel(model, candidate))) continue;
    const rates = rule.longContext && inputTokens > rule.longContext.aboveInputTokens
      ? rule.longContext.rates
      : rule.standard;
    return {
      ...rates,
      source: rule.source,
      asOf: PRICING_AS_OF,
    };
  }
  return null;
}

export function estimateTokenCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  customRates?: { inputPerMillion: number; outputPerMillion: number },
  imageInputTokens: number = 0,
): TokenCostEstimate | null {
  const normalizedInput = Math.max(0, Math.floor(inputTokens));
  const normalizedOutput = Math.max(0, Math.floor(outputTokens));
  const normalizedImageInput = Math.min(normalizedInput, Math.max(0, Math.floor(imageInputTokens)));
  const rates = customRates
    ? {
        ...customRates,
        source: 'custom',
        asOf: PRICING_AS_OF,
      }
    : resolveTokenRates(modelName, normalizedInput);
  if (!rates) return null;

  const inputCostUsd = ((normalizedInput - normalizedImageInput) * rates.inputPerMillion
    + normalizedImageInput * (rates.imageInputPerMillion ?? rates.inputPerMillion)) / 1_000_000;
  const outputCostUsd = normalizedOutput * rates.outputPerMillion / 1_000_000;
  return {
    model: normalizeModelName(modelName),
    inputTokens: normalizedInput,
    imageInputTokens: normalizedImageInput,
    outputTokens: normalizedOutput,
    totalTokens: normalizedInput + normalizedOutput,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    ...rates,
  };
}
