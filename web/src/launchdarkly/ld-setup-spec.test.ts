import { describe, expect, it } from 'vitest';
import * as spec from '../../../scripts/ld-targeting.mjs';
import { CHECKOUT_METRICS } from '../../../scripts/ld-metrics.mjs';
import { CENTRAL_STATES, FALLBACKS, FLAGS, HERO_TARGETING, METRIC_EVENTS } from './config';

/**
 * scripts/ld-targeting.mjs is what `npm run ld:setup` writes to LaunchDarkly.
 * config.ts is what the Release Console uses to name the matched rule.
 * If they drift apart, the console would label the wrong rule.
 */
describe('LaunchDarkly setup spec stays in step with the app', () => {
  it('targets the flag the hero reads', () => {
    expect(spec.HERO_FLAG.key).toBe(FLAGS.landingHero);
  });

  it('has the same individual targets', () => {
    expect(spec.HERO_TARGETING.individualTargets).toEqual([...HERO_TARGETING.individualTargets]);
  });

  it('has the same rules in the same order', () => {
    expect(spec.HERO_TARGETING.rules.map((r) => r.description)).toEqual(HERO_TARGETING.rules.map((r) => r.name));
  });

  it('uses the same Central states', () => {
    expect(spec.CENTRAL_STATES).toEqual([...CENTRAL_STATES]);
  });

  it('serves true from every target and rule, and the safe fallback by default and when off', () => {
    const instructions = spec.heroTargetingInstructions({ trueId: 'T', falseId: 'F' });
    const byKind = Object.fromEntries(instructions.map((i) => [i.kind, i])) as Record<string, Record<string, unknown>>;
    expect((byKind.replaceTargets.targets as { variationId: string }[]).every((t) => t.variationId === 'T')).toBe(true);
    expect((byKind.replaceRules.rules as { variationId: string }[]).every((r) => r.variationId === 'T')).toBe(true);
    expect(FALLBACKS.landingHero).toBe(false);
    expect(byKind.updateFallthroughVariationOrRollout.variationId).toBe('F');
    expect(byKind.updateOffVariation.variationId).toBe('F');
    expect(instructions.at(-1)).toEqual({ kind: 'turnFlagOn' });
  });

  it('defines the beta segment on the betaTester attribute as a boolean', () => {
    expect(spec.BETA_SEGMENT.key).toBe('beta-shoppers');
    expect(spec.BETA_SEGMENT.rules[0].clauses[0]).toMatchObject({ attribute: 'betaTester', op: 'in', values: [true] });
  });
});

describe('Part 1 metrics stay in step with the checkout event', () => {
  it('reads the event the checkout drawer sends', () => {
    expect(CHECKOUT_METRICS.map((m) => m.eventKey)).toEqual([METRIC_EVENTS.checkoutCompleted, METRIC_EVENTS.checkoutCompleted]);
  });

  it('defines one conversion metric and one order value metric with the fields LaunchDarkly requires', () => {
    const [conversion, value] = CHECKOUT_METRICS;
    expect(conversion).toMatchObject({ kind: 'custom', isNumeric: false, successCriteria: 'HigherThanBaseline' });
    expect(value).toMatchObject({ kind: 'custom', isNumeric: true, unit: 'dollars', successCriteria: 'HigherThanBaseline' });
  });
});
