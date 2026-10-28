// Types for ld-targeting.mjs, so the web unit tests can import it.

export interface Clause {
  contextKind?: string;
  attribute: string;
  op: string;
  values: unknown[];
  negate: boolean;
}

export declare const HERO_FLAG: {
  key: string;
  name: string;
  description: string;
  variations: { value: boolean; name: string }[];
};

export declare const BETA_SEGMENT: {
  key: string;
  name: string;
  description: string;
  rules: { clauses: Clause[] }[];
};

export declare const CENTRAL_STATES: string[];

export declare const HERO_TARGETING: {
  individualTargets: string[];
  rules: { description: string; clauses: Clause[] }[];
};

export declare function heroTargetingInstructions(ids: { trueId: string; falseId: string }): Record<string, unknown>[];
