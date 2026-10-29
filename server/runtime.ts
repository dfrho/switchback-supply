import { createHash } from 'node:crypto';
import { basicLogger, init, type LDClient } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';
import Anthropic from '@anthropic-ai/sdk';
import type { AssistantDeps } from './assistant.js';
import { createTokenSigner } from './tokens.js';

/**
 * Real clients for the assistant, created once per server process.
 *
 * The LaunchDarkly server SDK opens a streaming connection and keeps every flag
 * and AI Config in memory, so evaluations are local and fast. Creating it per
 * request would reconnect every time. On Vercel, a warm function instance serves
 * many requests, so this module-level singleton is reused between them.
 * Docs: https://launchdarkly.com/docs/sdk/server-side/node-js
 */

export class NotConfigured extends Error {}

let ldClient: LDClient | undefined;
let deps: AssistantDeps | undefined;

export async function getDeps(): Promise<{ deps: AssistantDeps; ld: LDClient }> {
  const sdkKey = process.env.LD_SDK_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!sdkKey || !anthropicKey) {
    throw new NotConfigured('Set LD_SDK_KEY and ANTHROPIC_API_KEY on the server (see .env.example).');
  }
  if (!ldClient || !deps) {
    // LD_LOG_LEVEL=debug (optional) shows the SDK's connection and event delivery in the server log.
    const level = process.env.LD_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined;
    ldClient = init(sdkKey, level ? { logger: basicLogger({ level }) } : {});
    deps = {
      ai: initAi(ldClient),
      ld: ldClient,
      anthropic: new Anthropic({ apiKey: anthropicKey }),
      // The signing secret is derived from the SDK key, so there is no extra secret to manage.
      tokens: createTokenSigner(createHash('sha256').update(`switchback-feedback:${sdkKey}`).digest('hex')),
    };
  }
  try {
    // Wait briefly for the first connection. If LaunchDarkly is slow or unreachable,
    // carry on: the SDK then serves the code fallback (assistant disabled).
    await ldClient.waitForInitialization({ timeout: 3 });
  } catch {
    console.warn('LaunchDarkly did not initialize in time; serving fallback values.');
  }
  return { deps, ld: ldClient };
}
