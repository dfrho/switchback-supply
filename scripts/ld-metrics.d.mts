// Types for ld-metrics.mjs, so the unit tests can import it.

export interface MetricSpec {
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
  randomizationUnits: string[];
}

export declare const CHECKOUT_METRICS: MetricSpec[];
