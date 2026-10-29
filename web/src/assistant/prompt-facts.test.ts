import { describe, expect, it } from 'vitest';
import * as spec from '../../../scripts/ld-ai-config.mjs';
import { FREE_SHIPPING_MIN } from '../data/catalog';

/** The assistant's prompts (scripts/ld-ai-config.mjs) state store facts; keep them true. */
describe('AgentControl prompts match the store', () => {
  it('states the real free-shipping threshold in every prompt', () => {
    for (const v of spec.VARIATIONS) {
      expect(v.prompt).toContain(`Orders of $${FREE_SHIPPING_MIN} or more ship free`);
    }
  });
});
