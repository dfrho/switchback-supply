import { describe, expect, it } from 'vitest';
import { HERO_TARGETING } from './config';
import { explainEvaluation, type RowStatus } from './explain';

const statuses = (reason: Parameters<typeof explainEvaluation>[0]): Record<string, RowStatus> =>
  Object.fromEntries(explainEvaluation(reason, HERO_TARGETING).rows.map((r) => [r.id, r.status]));

describe('explainEvaluation', () => {
  it('lists individual targets, each rule in order, then the default rule', () => {
    const { rows } = explainEvaluation({ kind: 'FALLTHROUGH' }, HERO_TARGETING);
    expect(rows.map((r) => r.label)).toEqual([
      'Individual targets',
      '1. Employees',
      '2. Beta shoppers',
      '3. Gold members in Central states',
      'Default rule',
    ]);
  });

  it('individual target: matched, and no rule is evaluated', () => {
    expect(explainEvaluation({ kind: 'TARGET_MATCH' }, HERO_TARGETING).summary).toBe('Individually targeted');
    expect(statuses({ kind: 'TARGET_MATCH' })).toEqual({
      individual: 'match',
      'rule-1': 'not-evaluated',
      'rule-2': 'not-evaluated',
      'rule-3': 'not-evaluated',
      default: 'not-evaluated',
    });
  });

  it('rule match: rules above did not match, rules below were never evaluated', () => {
    const reason = { kind: 'RULE_MATCH', ruleIndex: 1, ruleId: 'beta' };
    expect(explainEvaluation(reason, HERO_TARGETING).summary).toBe('Matched rule 2: Beta shoppers');
    expect(statuses(reason)).toEqual({
      individual: 'no-match',
      'rule-1': 'no-match',
      'rule-2': 'match',
      'rule-3': 'not-evaluated',
      default: 'not-evaluated',
    });
  });

  it('fallthrough: nothing matched and the default rule served', () => {
    expect(statuses({ kind: 'FALLTHROUGH' })).toEqual({
      individual: 'no-match',
      'rule-1': 'no-match',
      'rule-2': 'no-match',
      'rule-3': 'no-match',
      default: 'match',
    });
  });

  it('flag off: nothing is evaluated', () => {
    expect(explainEvaluation({ kind: 'OFF' }, HERO_TARGETING).summary).toBe('Flag is off; off variation served');
    expect(Object.values(statuses({ kind: 'OFF' }))).toEqual(Array(5).fill('not-evaluated'));
  });

  it('no reason yet, or an error: says a fallback is being served', () => {
    expect(explainEvaluation(undefined, HERO_TARGETING).summary).toBe('Waiting for LaunchDarkly; fallback served');
    expect(explainEvaluation({ kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' }, HERO_TARGETING).summary).toContain('FLAG_NOT_FOUND');
  });
});
