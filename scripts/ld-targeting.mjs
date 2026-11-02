/**
 * The Part 2 LaunchDarkly configuration, as data.
 *
 * `npm run ld:setup` applies this to your LaunchDarkly environment through the
 * REST API, so the targeting is reproducible and reviewable in a pull request
 * ("configuration as code"). A unit test checks that it stays in step with
 * HERO_TARGETING in web/src/launchdarkly/config.ts, which the Release Console
 * uses to label LaunchDarkly's evaluation reasons.
 */

export const HERO_FLAG = {
  key: 'release-landing-hero',
  name: 'Release landing hero',
  description:
    'Part 2: Target. Serves the Winter-Ready home page hero (true) or the current hero (false) to targeted shoppers.',
  variations: [
    { value: true, name: 'Winter-Ready hero' },
    { value: false, name: 'Current hero' },
  ],
};

export const BETA_SEGMENT = {
  key: 'beta-shoppers',
  name: 'Beta shoppers',
  description: 'Shoppers who opted into early access (betaTester is true). Used by release-landing-hero.',
  rules: [{ clauses: [{ contextKind: 'user', attribute: 'betaTester', op: 'in', values: [true], negate: false }] }],
};

/**
 * The Central region for rule 3 (Gold members in Central states). Must match
 * CENTRAL_STATES in web/src/launchdarkly/config.ts; a unit test checks.
 */
export const CENTRAL_STATES = ['TN', 'TX', 'IL', 'MN', 'CO'];

/** Evaluated top to bottom; the first match wins. Every target and rule serves true. */
export const HERO_TARGETING = {
  individualTargets: ['qa-tester-001'],
  rules: [
    {
      description: 'Employees',
      clauses: [{ contextKind: 'user', attribute: 'email', op: 'endsWith', values: ['@switchbacksupply.test'], negate: false }],
    },
    {
      description: 'Beta shoppers',
      clauses: [{ attribute: 'segmentMatch', op: 'segmentMatch', values: [BETA_SEGMENT.key], negate: false }],
    },
    {
      description: 'Gold members in Central states',
      clauses: [
        { contextKind: 'user', attribute: 'loyaltyTier', op: 'in', values: ['gold'], negate: false },
        { contextKind: 'user', attribute: 'state', op: 'in', values: CENTRAL_STATES, negate: false },
      ],
    },
  ],
};

/**
 * Semantic patch instructions that make the flag's targeting in one environment
 * match HERO_TARGETING exactly. "replace" instructions make the script safe to
 * run again: it converges on the same result instead of adding duplicates.
 * https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag
 */
export function heroTargetingInstructions({ trueId, falseId }) {
  return [
    {
      kind: 'replaceTargets',
      targets: [{ contextKind: 'user', variationId: trueId, values: HERO_TARGETING.individualTargets }],
    },
    {
      kind: 'replaceRules',
      rules: HERO_TARGETING.rules.map((rule) => ({ ...rule, variationId: trueId })),
    },
    { kind: 'updateFallthroughVariationOrRollout', variationId: falseId },
    { kind: 'updateOffVariation', variationId: falseId },
    { kind: 'turnFlagOn' },
  ];
}
