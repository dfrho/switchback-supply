/**
 * Turns LaunchDarkly's evaluation reason into a row-by-row explanation of the
 * flag's targeting, for the Release Console.
 *
 * LaunchDarkly checks targeting top to bottom and stops at the first match:
 *   individual targets, then each rule in order, then the default rule.
 * So rows above the match did not match, and rows below it were never evaluated.
 * Nothing here re-implements targeting; it only reads the reason LaunchDarkly sent.
 */

export type RowStatus = 'match' | 'no-match' | 'not-evaluated';

export interface ExplainRow {
  id: string;
  label: string;
  detail?: string;
  status: RowStatus;
}

export interface Explanation {
  summary: string;
  rows: ExplainRow[];
}

/** The subset of LaunchDarkly's evaluation reason this uses. */
export interface EvaluationReason {
  kind: string;
  ruleIndex?: number;
  ruleId?: string;
  errorKind?: string;
}

interface Targeting {
  rules: readonly { name: string; detail?: string }[];
}

export function explainEvaluation(reason: EvaluationReason | null | undefined, targeting: Targeting): Explanation {
  const ruleCount = targeting.rules.length;
  const build = (statusFor: (rowIndex: number) => RowStatus): ExplainRow[] => [
    { id: 'individual', label: 'Individual targets', status: statusFor(-1) },
    ...targeting.rules.map((r, i) => ({ id: `rule-${i + 1}`, label: `${i + 1}. ${r.name}`, detail: r.detail, status: statusFor(i) })),
    { id: 'default', label: 'Default rule', status: statusFor(ruleCount) },
  ];

  switch (reason?.kind) {
    case 'TARGET_MATCH':
      return { summary: 'Individually targeted', rows: build((i) => (i === -1 ? 'match' : 'not-evaluated')) };
    case 'RULE_MATCH': {
      const matched = reason.ruleIndex ?? -2;
      const name = targeting.rules[matched]?.name ?? `rule ${matched + 1}`;
      return {
        summary: `Matched rule ${matched + 1}: ${name}`,
        rows: build((i) => (i === matched ? 'match' : i < matched ? 'no-match' : 'not-evaluated')),
      };
    }
    case 'FALLTHROUGH':
      return { summary: 'No targeting matched; default rule served', rows: build((i) => (i === ruleCount ? 'match' : 'no-match')) };
    case 'OFF':
      return { summary: 'Flag is off; off variation served', rows: build(() => 'not-evaluated') };
    case 'PREREQUISITE_FAILED':
      return { summary: 'A prerequisite flag was not met', rows: build(() => 'not-evaluated') };
    case 'ERROR':
      return { summary: `LaunchDarkly could not evaluate the flag (${reason.errorKind ?? 'error'}); fallback served`, rows: build(() => 'not-evaluated') };
    default:
      return { summary: 'Waiting for LaunchDarkly; fallback served', rows: build(() => 'not-evaluated') };
  }
}
