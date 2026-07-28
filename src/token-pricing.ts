export interface TokenRates {
  inputPerMillion: number;
  outputPerMillion: number;
  source: string;
  asOf: string;
}

export interface TokenCostEstimate extends TokenRates {
  model: string;
  inputTokens: number;
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

const PRICING_AS_OF = '2026-07-27';
const GEMINI_PRICING_SOURCE = 'https://ai.google.dev/gemini-api/docs/pricing';
const OPENAI_PRICING_SOURCE = 'https://developers.openai.com/api/docs/pricing';

// Standard, paid-tier text-token rates in USD per one million tokens.
// Keep longer/more-specific model names before their family prefixes.
const PRICING_RULES: PricingRule[] = [
  {
    models: ['gemini-3.6-flash'],
    standard: { inputPerMillion: 1.5, outputPerMillion: 7.5 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.5-flash-lite'],
    standard: { inputPerMillion: 0.3, outputPerMillion: 2.5 },
    source: GEMINI_PRICING_SOURCE,
  },
  {
    models: ['gemini-3.5-flash'],
    standard: { inputPerMillion: 1.5, outputPerMillion: 9 },
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
    models: ['gpt-5.6-sol', 'gpt-5.6'],
    standard: { inputPerMillion: 5, outputPerMillion: 30 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 10, outputPerMillion: 45 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.6-terra'],
    standard: { inputPerMillion: 2.5, outputPerMillion: 15 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 5, outputPerMillion: 22.5 },
    },
    source: OPENAI_PRICING_SOURCE,
  },
  {
    models: ['gpt-5.6-luna'],
    standard: { inputPerMillion: 1, outputPerMillion: 6 },
    longContext: {
      aboveInputTokens: 272_000,
      rates: { inputPerMillion: 2, outputPerMillion: 9 },
    },
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
  // Match dated/preview snapshots, but not distinct model tiers.
  return /^(?:\d|preview(?:-|$)|latest$)/.test(suffix);
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
): TokenCostEstimate | null {
  const normalizedInput = Math.max(0, Math.floor(inputTokens));
  const normalizedOutput = Math.max(0, Math.floor(outputTokens));
  const rates = customRates
    ? {
        ...customRates,
        source: 'custom',
        asOf: PRICING_AS_OF,
      }
    : resolveTokenRates(modelName, normalizedInput);
  if (!rates) return null;

  const inputCostUsd = normalizedInput * rates.inputPerMillion / 1_000_000;
  const outputCostUsd = normalizedOutput * rates.outputPerMillion / 1_000_000;
  return {
    model: normalizeModelName(modelName),
    inputTokens: normalizedInput,
    outputTokens: normalizedOutput,
    totalTokens: normalizedInput + normalizedOutput,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    ...rates,
  };
}
