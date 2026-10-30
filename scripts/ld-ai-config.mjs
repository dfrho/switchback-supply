/**
 * The AgentControl (formerly AI Configs) setup for the shopping assistant, as data.
 *
 * `npm run ld:setup` writes this to LaunchDarkly. A unit test checks that the
 * config key and the metric's event key match what the server uses
 * (server/config.ts), so the two cannot drift apart.
 *
 * Four variations, each changing one thing from Control, so an experiment can
 * tell whether the prompt or the model made the difference:
 *   Control      Claude Haiku 5.5   + guide prompt
 *   Treatment A  Claude Haiku 5.5   + best-pick prompt  (prompt change only; iteration 1)
 *   Treatment B  Claude Sonnet 5.5  + guide prompt      (model change only)
 *   Treatment C  Claude Haiku 5.5   + kit prompt        (prompt change only; iteration 2)
 *
 * Iteration 2 asks: can a prompt change get the bigger, free-shipping baskets a
 * larger model builds, at the smaller model's speed and price?
 *
 * {{catalog}} is filled by the server with one line per product. {{ldctx.*}}
 * values come from the shopper's LaunchDarkly context.
 */

// The $150 free-shipping threshold is FREE_SHIPPING_MIN in web/src/data/catalog.ts.
const STORE_RULES = `Recommend only products from the catalog below. Link every product you mention as [Product Name](/products/<id>), using the id from the catalog. Never invent products, prices, specs, or stock. If nothing in the catalog fits, say so plainly and give general advice instead. Write in plain language with no emojis. Keep the whole answer under 150 words.

Orders of $150 or more ship free; mention it only when it is relevant. The shopper is in the US state "{{ldctx.state}}" (blank if unknown); use it only for hints about local weather and terrain.

Catalog (id | name | category | price | summary | tags):
{{catalog}}`;

export const GUIDE_PROMPT = `You are the Trail Guide for Switchback Supply, an outdoor gear store. Help shoppers choose gear for their trips. Suggest up to three products, with one short sentence each on why it fits the trip.

${STORE_RULES}`;

export const BEST_PICK_PROMPT = `You are the Trail Guide for Switchback Supply, an outdoor gear store. Help shoppers choose gear for their trips. Lead with the single best product for the shopper's trip and explain in two sentences why it fits. Then offer at most one alternative at a different price. If an important detail about the trip is missing, end with one short question about it.

${STORE_RULES}`;

export const KIT_PROMPT = `You are the Trail Guide for Switchback Supply, an outdoor gear store. Help shoppers choose gear for their trips. Think about the whole trip and suggest a kit: up to three products that work together, with one short sentence each on the job it does on that trip. Choose only items the trip really needs, and stay within any budget the shopper gives. If the kit totals $150 or more, say that it ships free.

${STORE_RULES}`;

export const AI_CONFIG = {
  key: 'shopping-assistant',
  name: 'Shopping assistant',
  mode: 'completion',
  description:
    'Extra credit: AI Configs. The Trail Guide chat in the store. Server-side only (server/assistant.ts). Variations compare a new prompt and a larger model against Control.',
};

/** LaunchDarkly model config keys use the format Provider.model-id. Costs are USD per token, for the Costs chart. */
export const MODELS = {
  haiku: { key: 'Anthropic.claude-haiku-5-5', id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', costPerInputToken: 0.1e-6, costPerOutputToken: 0.5e-6 },
  sonnet: { key: 'Anthropic.claude-sonnet-5-5', id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', costPerInputToken: 2e-6, costPerOutputToken: 10e-6 },
};

/** max_tokens is required by Anthropic; effort low keeps chat answers quick. Both are editable in LaunchDarkly. */
const PARAMETERS = { max_tokens: 1024, effort: 'low' };

export const VARIATIONS = [
  { key: 'control', name: 'Control: Haiku 5.5, guide prompt', model: MODELS.haiku, prompt: GUIDE_PROMPT },
  { key: 'best-pick', name: 'Treatment A: Haiku 5.5, best-pick prompt', model: MODELS.haiku, prompt: BEST_PICK_PROMPT },
  { key: 'sonnet', name: 'Treatment B: Sonnet 5.5, guide prompt', model: MODELS.sonnet, prompt: GUIDE_PROMPT },
  { key: 'bundle', name: 'Treatment C: Haiku 5.5, kit prompt', model: MODELS.haiku, prompt: KIT_PROMPT },
];

/** Default rule before any experiment starts: everyone gets Control. */
export const DEFAULT_VARIATION_KEY = 'control';

/** The request body for creating or updating one variation. */
export function variationBody(variation) {
  return {
    name: variation.name,
    messages: [{ role: 'system', content: variation.prompt }],
    model: { modelName: variation.model.id, parameters: PARAMETERS },
    modelConfigKey: variation.model.key,
  };
}

/** Iteration 1's primary metric. The server sends this event (server/config.ts METRIC_EVENTS). */
export const RECOMMENDED_PRODUCT_METRIC = {
  key: 'assistant-recommended-product',
  name: 'Assistant recommended a product',
  description:
    'Conversion: the trail guide reply linked at least one real catalog product. Sent server-side from server/assistant.ts after checking each link against the catalog.',
  kind: 'custom',
  eventKey: 'assistant-recommended-product',
  isNumeric: false,
  successCriteria: 'HigherThanBaseline',
  randomizationUnits: ['user'],
};

/**
 * Iteration 2's metrics, all measured server-side from real replies (server/assistant.ts).
 * Value metrics average each shopper's events, then compare the means across variations.
 */
export const BASKET_METRICS = [
  {
    key: 'assistant-free-shipping-basket',
    name: 'Assistant kit ships free',
    description:
      'Conversion, primary: the real products a trail guide reply recommended total $150 or more, so that kit would ship free.',
    kind: 'custom',
    eventKey: 'assistant-free-shipping-basket',
    isNumeric: false,
    successCriteria: 'HigherThanBaseline',
    randomizationUnits: ['user'],
  },
  {
    key: 'assistant-basket-value',
    name: 'Assistant kit value',
    description:
      'Value: the total price in dollars of the real products a reply recommended. Replies that recommend nothing count as $0.',
    kind: 'custom',
    eventKey: 'assistant-basket-value',
    isNumeric: true,
    unit: 'dollars',
    unitAggregationType: 'average',
    analysisType: 'mean',
    successCriteria: 'HigherThanBaseline',
    randomizationUnits: ['user'],
  },
  {
    key: 'assistant-response-time',
    name: 'Assistant response time',
    description:
      'Guardrail: milliseconds from asking the model to receiving its answer. Shoppers without an answer are left out instead of counting as 0 ms.',
    kind: 'custom',
    eventKey: 'assistant-response-time',
    isNumeric: true,
    unit: 'milliseconds',
    unitAggregationType: 'average',
    analysisType: 'mean',
    successCriteria: 'LowerThanBaseline',
    // A shopper with no event must not count as an instant answer.
    eventDefault: { disabled: true },
    randomizationUnits: ['user'],
  },
];
