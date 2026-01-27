/**
 * AI Model Pricing Constants
 *
 * Pricing for Claude models (API pricing as of January 2025)
 * Used for cost estimation and display in analytics
 *
 * Note: These are API prices. Claude Code subscription users have
 * different rate limit-based costs that don't translate directly to dollars.
 */

// ============================================
// Claude Model Pricing (per million tokens)
// ============================================

export interface ModelPricing {
  inputPerMillion: number;  // Cost per 1M input tokens
  outputPerMillion: number; // Cost per 1M output tokens
  cacheWritePerMillion?: number;  // Cost per 1M cache write tokens
  cacheReadPerMillion?: number;   // Cost per 1M cache read tokens
}

/**
 * Claude model pricing as of January 2025
 * Source: https://www.anthropic.com/pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude Opus 4.5
  'opus': {
    inputPerMillion: 15.00,
    outputPerMillion: 75.00,
    cacheWritePerMillion: 18.75,  // 1.25x input price
    cacheReadPerMillion: 1.50,    // 0.1x input price
  },
  'claude-opus-4-5-20251101': {
    inputPerMillion: 15.00,
    outputPerMillion: 75.00,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.50,
  },

  // Claude Sonnet 4.5
  'sonnet': {
    inputPerMillion: 3.00,
    outputPerMillion: 15.00,
    cacheWritePerMillion: 3.75,   // 1.25x input price
    cacheReadPerMillion: 0.30,    // 0.1x input price
  },
  'claude-sonnet-4-5-20250929': {
    inputPerMillion: 3.00,
    outputPerMillion: 15.00,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.30,
  },

  // Claude Haiku 4.5
  'haiku': {
    inputPerMillion: 0.80,
    outputPerMillion: 4.00,
    cacheWritePerMillion: 1.00,   // 1.25x input price
    cacheReadPerMillion: 0.08,    // 0.1x input price
  },
  'claude-haiku-4-5-20251001': {
    inputPerMillion: 0.80,
    outputPerMillion: 4.00,
    cacheWritePerMillion: 1.00,
    cacheReadPerMillion: 0.08,
  },
} as const;

// Default pricing for unknown models (uses Sonnet pricing as middle ground)
export const DEFAULT_MODEL_PRICING: ModelPricing = MODEL_PRICING.sonnet;

/**
 * Calculate estimated API cost from token counts
 */
export function calculateApiCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'sonnet',
  cacheWriteTokens?: number,
  cacheReadTokens?: number
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_MODEL_PRICING;

  let cost = 0;
  cost += (inputTokens / 1_000_000) * pricing.inputPerMillion;
  cost += (outputTokens / 1_000_000) * pricing.outputPerMillion;

  if (cacheWriteTokens && pricing.cacheWritePerMillion) {
    cost += (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion;
  }
  if (cacheReadTokens && pricing.cacheReadPerMillion) {
    cost += (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;
  }

  return cost;
}

/**
 * Format cost for display
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(4)}`;
  }
  if (costUsd < 1) {
    return `$${costUsd.toFixed(3)}`;
  }
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Format token count for display (with thousands separator)
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

// ============================================
// Rate Limit Estimation (Claude Code Subscription)
// ============================================

/**
 * Estimated rate limit weight per token
 * This is an approximation - actual rate limit impact varies
 *
 * Claude Code uses a rate limit system rather than per-token billing.
 * These weights help estimate the "rate limit cost" of API calls.
 */
export const RATE_LIMIT_WEIGHTS = {
  // Output tokens cost more in rate limit terms
  inputWeight: 1,
  outputWeight: 5,  // Output is ~5x more "expensive" in rate limit terms
} as const;

/**
 * Estimate rate limit impact from token usage
 * Returns a "rate limit units" value (not dollars)
 */
export function estimateRateLimitImpact(
  inputTokens: number,
  outputTokens: number
): number {
  return (
    inputTokens * RATE_LIMIT_WEIGHTS.inputWeight +
    outputTokens * RATE_LIMIT_WEIGHTS.outputWeight
  );
}
