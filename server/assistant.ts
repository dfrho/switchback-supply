import type { LDContext } from '@launchdarkly/node-server-sdk';
import { LDFeedbackKind, type LDAIClient, type LDAIMetrics, type LDMessage } from '@launchdarkly/server-sdk-ai';
import type Anthropic from '@anthropic-ai/sdk';
import { basketValue, compactCatalog, findRecommendedProducts } from './catalog.js';
import { AI_CONFIGS, ASSISTANT_FALLBACK, ERROR_REPLY, FALLBACK_REPLY, FREE_SHIPPING_MIN, LIMITS, METRIC_EVENTS } from './config.js';
import { BadRequest, shopperContext } from './shopper.js';

/**
 * The AI shopping assistant, one request at a time.
 *
 * LaunchDarkly AgentControl (formerly AI Configs) decides which model and which
 * prompt each shopper gets; this code asks for that configuration, calls Claude
 * with it, and reports how the call went. Changing the model or the prompt is a
 * change in LaunchDarkly, not a code change or a redeploy.
 *
 * Dependencies are passed in so the Vercel function, the local dev server, and
 * the unit tests all run this same code (the tests pass fakes).
 * Docs: https://launchdarkly.com/docs/sdk/ai/node-js-legacy
 */

export interface AssistantDeps {
  ai: Pick<LDAIClient, 'completionConfig' | 'createTracker'>;
  ld: { track(key: string, context: LDContext, data?: unknown, metricValue?: number): void };
  anthropic: { messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> } };
  /** Wraps a tracker's resumption token so the browser can send feedback later without being able to forge it. */
  tokens: { sign(token: string): string; verify(signed: string): string | null };
  /** Clock for the response-time metric; tests pass a fake. Defaults to Date.now. */
  now?: () => number;
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantReply {
  reply: string;
  /** Catalog ids the reply recommended (only real ones). */
  products: string[];
  /** "claude" when a model answered; "off" when the config is disabled; "error" when the call failed. */
  source: 'claude' | 'off' | 'error';
  /** Which model and variation answered, so a change in LaunchDarkly is visible in the chat. */
  model?: string;
  variation?: string;
  /** Present only for model answers; sent back with thumbs up or down. */
  feedbackToken?: string;
}

function parseHistory(input: unknown): Turn[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new BadRequest('Invalid history.');
  return input.slice(-LIMITS.historyTurns).map((t) => {
    const turn = t as Partial<Turn>;
    if ((turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.content !== 'string') {
      throw new BadRequest('Invalid history.');
    }
    return { role: turn.role, content: turn.content.slice(0, LIMITS.historyChars) };
  });
}

/**
 * Anthropic's Messages API takes the system prompt as a top-level `system`
 * field, not as a message, and the conversation must start with a user turn and
 * alternate roles. AgentControl stores a prompt as a list of role-tagged
 * messages, so this converts one shape into the other.
 */
export function toAnthropicMessages(configMessages: LDMessage[], history: Turn[], userMessage: string) {
  const system = configMessages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const turns: Turn[] = [
    ...configMessages.filter((m): m is LDMessage & Turn => m.role !== 'system'),
    ...history,
    { role: 'user', content: userMessage },
  ];
  const messages: Turn[] = [];
  for (const turn of turns) {
    if (messages.length === 0 && turn.role !== 'user') continue;
    const last = messages.at(-1);
    if (last?.role === turn.role) last.content += `\n\n${turn.content}`;
    else messages.push({ ...turn });
  }
  return { system, messages };
}

/**
 * Model parameters from the variation. Only two are forwarded, each checked:
 *   max_tokens  required by Anthropic. LaunchDarkly's UI says max_tokens; some docs say maxTokens.
 *   effort      how much the model thinks before answering (low, medium, high, xhigh, max).
 * Current Claude models reject sampling parameters such as temperature, so passing
 * every parameter through would let one dashboard edit break the assistant.
 */
export function maxTokensFrom(parameters: Record<string, unknown> | undefined): number {
  const requested = Number(parameters?.max_tokens ?? parameters?.maxTokens);
  if (!Number.isFinite(requested) || requested <= 0) return LIMITS.defaultMaxTokens;
  return Math.min(Math.round(requested), LIMITS.maxTokensCeiling);
}

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
type Effort = (typeof EFFORTS)[number];

export function effortFrom(parameters: Record<string, unknown> | undefined): Effort {
  const requested = parameters?.effort;
  return EFFORTS.includes(requested as Effort) ? (requested as Effort) : LIMITS.defaultEffort;
}

/**
 * Reads token usage from Claude's response for the tracker. There is no LaunchDarkly
 * provider package for Anthropic, so this small extractor is the documented pattern.
 * A safety decline (stop_reason "refusal") returns normally but gives the shopper no
 * answer, so it counts as an error: trackMetricsOf then records an error instead of
 * a success, and Monitoring shows declines against the variation that produced them.
 */
export function toMetrics(message: Anthropic.Message): LDAIMetrics {
  const input = message.usage.input_tokens;
  const output = message.usage.output_tokens;
  return { success: message.stop_reason !== 'refusal', tokens: { input, output, total: input + output } };
}

export async function answer(deps: AssistantDeps, body: unknown): Promise<AssistantReply> {
  const request = (body ?? {}) as Record<string, unknown>;
  const message = typeof request.message === 'string' ? request.message.trim() : '';
  if (!message) throw new BadRequest('Ask a question first.');
  if (message.length > LIMITS.messageChars) throw new BadRequest(`Keep questions under ${LIMITS.messageChars} characters.`);
  const history = parseHistory(request.history);
  const context = shopperContext(request.shopper);

  // 1. Ask LaunchDarkly which configuration this shopper gets. Evaluated per request
  //    and per shopper, so targeting rules and experiment splits apply to each one.
  //    {{catalog}} in the prompt is filled from this variables object.
  const config = await deps.ai.completionConfig(AI_CONFIGS.assistant, context, ASSISTANT_FALLBACK, {
    catalog: compactCatalog(),
  });

  // 2. Disabled (turned off in LaunchDarkly, or unreachable): no model call at all.
  if (!config.enabled || !config.model?.name) {
    return { reply: FALLBACK_REPLY, products: [], source: 'off' };
  }

  // 3. One tracker per answer. It reports duration, tokens, and success or error to
  //    the config's Monitoring tab, attributed to the variation that was served.
  const tracker = config.createTracker();
  const { variationKey, modelName } = tracker.getTrackData();
  const { system, messages } = toAnthropicMessages(config.messages ?? [], history, message);

  const now = deps.now ?? Date.now;
  const started = now();
  let response: Anthropic.Message;
  try {
    response = await tracker.trackMetricsOf(toMetrics, () =>
      deps.anthropic.messages.create({
        model: config.model!.name,
        max_tokens: maxTokensFrom(config.model!.parameters),
        output_config: { effort: effortFrom(config.model!.parameters) },
        system,
        messages,
      }),
    );
  } catch (error) {
    // trackMetricsOf has already recorded the error for this variation.
    console.error('Assistant model call failed:', error instanceof Error ? error.message : error);
    return { reply: ERROR_REPLY, products: [], source: 'error', model: modelName, variation: variationKey };
  }

  // A safety decline returns normally with stop_reason "refusal" and no useful text.
  if (response.stop_reason === 'refusal') {
    return { reply: ERROR_REPLY, products: [], source: 'error', model: modelName, variation: variationKey };
  }

  const reply = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  const products = findRecommendedProducts(reply);

  // 4. Experiment metrics, measured from the real reply, server-side, with the same
  //    context that was evaluated, so LaunchDarkly credits the right variation.
  //    Guardrail: how long the shopper waited for this answer.
  deps.ld.track(METRIC_EVENTS.responseTime, context, { variationKey }, now() - started);
  if (products.length > 0) {
    // Did this answer point the shopper at something we sell, and what would that kit cost?
    const basket = basketValue(products);
    const data = { productIds: products, basket, variationKey };
    deps.ld.track(METRIC_EVENTS.recommendedProduct, context, data);
    deps.ld.track(METRIC_EVENTS.basketValue, context, data, basket);
    if (basket >= FREE_SHIPPING_MIN) deps.ld.track(METRIC_EVENTS.freeShippingBasket, context, data);
  }

  return {
    reply,
    products,
    source: 'claude',
    model: modelName,
    variation: variationKey,
    feedbackToken: deps.tokens.sign(tracker.resumptionToken),
  };
}

/**
 * Thumbs up or down on an earlier answer. The resumption token rebuilds that
 * answer's tracker, so the feedback lands on the same run and the same variation
 * (the Satisfaction chart on the Monitoring tab).
 */
export function recordFeedback(deps: AssistantDeps, body: unknown): void {
  const request = (body ?? {}) as Record<string, unknown>;
  const token = typeof request.feedbackToken === 'string' ? deps.tokens.verify(request.feedbackToken) : null;
  if (!token) throw new BadRequest('Unknown answer.');
  if (request.kind !== 'positive' && request.kind !== 'negative') throw new BadRequest('Feedback must be positive or negative.');
  const context = shopperContext(request.shopper);
  deps.ai
    .createTracker(token, context)
    .trackFeedback({ kind: request.kind === 'positive' ? LDFeedbackKind.Positive : LDFeedbackKind.Negative });
}
