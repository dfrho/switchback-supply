import { describe, expect, it } from 'vitest';
import * as spec from '../scripts/ld-ai-config.mjs';
import { AI_CONFIGS, METRIC_EVENTS } from './config.js';
import { maxTokensFrom, effortFrom } from './assistant.js';

/**
 * scripts/ld-ai-config.mjs is what `npm run ld:setup` writes to LaunchDarkly.
 * server/config.ts is what the assistant reads and sends. If they drift apart,
 * the server would ask for a config that does not exist, or send an event no
 * metric listens to.
 */
describe('AgentControl setup spec stays in step with the server', () => {
  it('creates the config the server evaluates', () => {
    expect(spec.AI_CONFIG.key).toBe(AI_CONFIGS.assistant);
    expect(spec.AI_CONFIG.mode).toBe('completion');
  });

  it("defines the metric on the server's event key", () => {
    expect(spec.RECOMMENDED_PRODUCT_METRIC.eventKey).toBe(METRIC_EVENTS.recommendedProduct);
    expect(spec.RECOMMENDED_PRODUCT_METRIC.isNumeric).toBe(false);
  });

  it("defines iteration 2's metrics on the server's event keys, in the right direction", () => {
    const byEvent = Object.fromEntries(spec.BASKET_METRICS.map((m) => [m.eventKey, m]));
    expect(byEvent[METRIC_EVENTS.freeShippingBasket]).toMatchObject({ isNumeric: false, successCriteria: 'HigherThanBaseline' });
    expect(byEvent[METRIC_EVENTS.basketValue]).toMatchObject({ isNumeric: true, unit: 'dollars', successCriteria: 'HigherThanBaseline' });
    // Lower is better, and a shopper without an answer must not count as 0 ms.
    expect(byEvent[METRIC_EVENTS.responseTime]).toMatchObject({
      isNumeric: true,
      unit: 'milliseconds',
      successCriteria: 'LowerThanBaseline',
      eventDefault: { disabled: true },
    });
  });

  it('has four variations, each changing one thing from Control', () => {
    const [control, bestPick, sonnet, kit] = spec.VARIATIONS;
    expect(spec.DEFAULT_VARIATION_KEY).toBe(control.key);
    for (const promptChange of [bestPick, kit]) {
      expect(promptChange.model).toBe(control.model);
      expect(promptChange.prompt).not.toBe(control.prompt);
    }
    expect(sonnet.prompt).toBe(control.prompt);
    expect(sonnet.model).not.toBe(control.model);
    expect(new Set(spec.VARIATIONS.map((v) => v.key)).size).toBe(4);
  });

  it('gives every prompt the catalog variable and product link format', () => {
    for (const v of spec.VARIATIONS) {
      expect(v.prompt).toContain('{{catalog}}');
      expect(v.prompt).toContain('(/products/<id>)');
    }
  });

  it('sends only parameters the server forwards, with values it accepts', () => {
    for (const v of spec.VARIATIONS) {
      const body = spec.variationBody(v);
      expect(body.modelConfigKey).toBe(`Anthropic.${body.model.modelName}`);
      expect(Object.keys(body.model.parameters).sort()).toEqual(['effort', 'max_tokens']);
      expect(maxTokensFrom(body.model.parameters)).toBe(body.model.parameters.max_tokens);
      expect(effortFrom(body.model.parameters)).toBe(body.model.parameters.effort);
    }
  });
});
