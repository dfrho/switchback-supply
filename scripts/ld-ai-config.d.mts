// Types for ld-ai-config.mjs, so the unit tests can import it.

export interface ModelSpec {
  key: string;
  id: string;
  name: string;
  costPerInputToken: number;
  costPerOutputToken: number;
}

export interface VariationSpec {
  key: string;
  name: string;
  model: ModelSpec;
  prompt: string;
}

export declare const GUIDE_PROMPT: string;
export declare const BEST_PICK_PROMPT: string;
export declare const KIT_PROMPT: string;
export declare const AI_CONFIG: { key: string; name: string; mode: string; description: string };
export declare const MODELS: { haiku: ModelSpec; sonnet: ModelSpec };
export declare const VARIATIONS: VariationSpec[];
export declare const DEFAULT_VARIATION_KEY: string;
export declare function variationBody(variation: VariationSpec): {
  name: string;
  messages: { role: string; content: string }[];
  model: { modelName: string; parameters: Record<string, unknown> };
  modelConfigKey: string;
};
export declare const RECOMMENDED_PRODUCT_METRIC: {
  key: string;
  name: string;
  description: string;
  kind: string;
  eventKey: string;
  isNumeric: boolean;
  successCriteria: string;
  randomizationUnits: string[];
};

export interface AssistantMetricSpec {
  key: string;
  name: string;
  description: string;
  kind: string;
  eventKey: string;
  isNumeric: boolean;
  unit?: string;
  unitAggregationType?: string;
  analysisType?: string;
  successCriteria: string;
  eventDefault?: { disabled: boolean };
  randomizationUnits: string[];
}

export declare const BASKET_METRICS: AssistantMetricSpec[];
