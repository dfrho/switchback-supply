import { describe, expect, it } from 'vitest';
import * as spec from '../../../scripts/ld-ai-config.mjs';
import { FREE_SHIPPING_MIN } from '../data/catalog';
import { FREE_SHIPPING_MIN as SERVER_FREE_SHIPPING_MIN } from '../../../server/config';

/** The assistant's prompts (scripts/ld-ai-config.mjs) state store facts; keep them true. */
describe('AgentControl prompts match the store', () => {
  it('states the real free-shipping threshold in every prompt', () => {
    for (const v of spec.VARIATIONS) {
      expect(v.prompt).toContain(`Orders of $${FREE_SHIPPING_MIN} or more ship free`);
    }
  });

  it('measures free-shipping kits on the server with the same threshold the store charges', () => {
    expect(SERVER_FREE_SHIPPING_MIN).toBe(FREE_SHIPPING_MIN);
  });
});
