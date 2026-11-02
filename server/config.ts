/**
 * Server-side LaunchDarkly configuration for the AI shopping assistant.
 *
 * SETUP: the assistant runs on the server, so it uses the server-side SDK key,
 * not the browser's client-side ID. Put both secrets in the repo-root .env
 * (local) and in Vercel > Settings > Environment Variables (live), never with
 * a VITE_ prefix:
 *   LD_SDK_KEY=          LaunchDarkly > gear icon > Projects > your project >
 *                        Environments > Test (or yours) > SDK key
 *   ANTHROPIC_API_KEY=   Anthropic Console > API keys
 */

import type { LDAICompletionConfigDefault } from '@launchdarkly/server-sdk-ai';

/**
 * AgentControl (formerly AI Configs) keys used by the app.
 * RECREATE THIS CONFIG: Agent management > Configs > Create > Completion, key "shopping-assistant",
 * with the three variations in scripts/ld-ai-config.mjs, default rule serving "Control".
 * `npm run ld:setup` creates all of it for you.
 */
export const AI_CONFIGS = {
  assistant: 'shopping-assistant',
} as const;

/**
 * Custom events the server sends for experiments. The event key must match the
 * metric's event key in LaunchDarkly exactly (Metrics > assistant-recommended-product).
 */
export const METRIC_EVENTS = {
  /** Sent when a reply links at least one real catalog product. Iteration 1's primary metric. */
  recommendedProduct: 'assistant-recommended-product',
  /**
   * Sent when the real products a reply recommends add up to FREE_SHIPPING_MIN or more:
   * the kit it suggested would ship free. Iteration 2's primary metric.
   */
  freeShippingBasket: 'assistant-free-shipping-basket',
  /** The recommended products' total price in dollars, sent as the metric value. */
  basketValue: 'assistant-basket-value',
  /** How long the shopper waited for the answer, in milliseconds, sent as the metric value. A guardrail. */
  responseTime: 'assistant-response-time',
} as const;

/**
 * Orders of this many dollars or more ship free. Same rule as the store
 * (FREE_SHIPPING_MIN in web/src/data/catalog.ts); a unit test keeps them equal.
 */
export const FREE_SHIPPING_MIN = 150;

/**
 * Served when LaunchDarkly is unreachable or the config is missing. Like every
 * flag fallback in this app, it is the safe choice: disabled, so no model is
 * called and the shopper gets FALLBACK_REPLY instead. Turning the config off
 * in LaunchDarkly has the same effect, which makes it a kill switch for the AI.
 */
export const ASSISTANT_FALLBACK: LDAICompletionConfigDefault = { enabled: false };

export const FALLBACK_REPLY =
  'The trail guide is off the clock right now. You can still browse [all gear](/shop), and every product page lists specs and stock.';

export const ERROR_REPLY =
  'The trail guide lost the signal for a moment. Please try again, or browse [all gear](/shop) in the meantime.';

/** Caps that keep a public demo endpoint cheap and hard to abuse. */
export const LIMITS = {
  messageChars: 500,
  historyTurns: 10,
  /**
   * Per earlier turn. A guide answer is under 150 words (about 1,000 characters),
   * so this keeps real conversations whole while stopping a caller from padding
   * history to inflate the paid model call.
   */
  historyChars: 1_500,
  /** Largest request body accepted, in bytes. Real requests are a few kilobytes. */
  bodyBytes: 20_000,
  /**
   * Used when a variation does not set max_tokens; Anthropic requires a value.
   * Current Claude models think before answering, and thinking counts toward this cap.
   */
  defaultMaxTokens: 1024,
  /** Upper bound even if a variation asks for more. */
  maxTokensCeiling: 2048,
  /** Used when a variation does not set effort. Low suits short chat answers. */
  defaultEffort: 'low',
} as const;
