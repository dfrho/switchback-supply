#!/usr/bin/env node
/**
 * PART 2, PART 1 METRICS, AND AI CONFIGS SETUP, AS CODE
 *
 * Creates or updates everything Part 2 and the AI Configs extra credit need in
 * one LaunchDarkly environment:
 *   1. The release-landing-hero flag (boolean, available to client-side SDKs)
 *   2. The beta-shoppers segment (betaTester is one of true)
 *   3. The hero's targeting: individual target, three rules in order, default false, flag On
 *      (plus Part 1's checkout-completed and checkout-order-value metrics)
 *   4. AgentControl (formerly AI Configs): Claude model configs if your project lacks them,
 *      the shopping-assistant config with four variations, and its default rule (Control)
 *   5. The assistant's experiment metrics: recommended a product (iteration 1), and kit ships
 *      free, kit value, and response time (iteration 2)
 *
 * It is safe to run again: it replaces targeting instead of appending to it, and
 * updates a variation only when its prompt or model changed. While an experiment
 * is running, do not change its variations (LaunchDarkly will warn you, and so does this script).
 *
 * Why a script? LaunchDarkly's dashboard offers only attributes it has already
 * seen from an SDK, so a brand-new environment cannot pick betaTester, loyaltyTier,
 * or state from the dropdowns. The REST API has no such limit. It also makes the
 * configuration reviewable and repeatable, which is how larger teams manage
 * LaunchDarkly (often with the Terraform provider, which uses this same API).
 *
 * SETUP (repo-root .env, never committed):
 *   LD_API_TOKEN=        Gear icon > Settings > Authorization (under Security) > Create token (role: Writer)
 *   LD_PROJECT_KEY=      optional, default "default"
 *   LD_ENVIRONMENT_KEY=  optional, default "production"
 *   LD_API_URL=          optional, for LaunchDarkly's EU or federal instances
 *
 * Usage:
 *   npm run ld:setup
 *   npm run ld:setup -- --dry-run     print the changes without calling LaunchDarkly
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BETA_SEGMENT, HERO_FLAG, HERO_TARGETING, heroTargetingInstructions } from './ld-targeting.mjs';
import { AI_CONFIG, BASKET_METRICS, DEFAULT_VARIATION_KEY, MODELS, RECOMMENDED_PRODUCT_METRIC, VARIATIONS, variationBody } from './ld-ai-config.mjs';
import { CHECKOUT_METRICS } from './ld-metrics.mjs';

const API_VERSION = '20240415';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

/** Reads KEY=value pairs from .env without executing it. Real environment variables win. */
function loadEnv() {
  const file = join(ROOT, '.env');
  const values = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...values, ...process.env };
}

const env = loadEnv();
const TOKEN = env.LD_API_TOKEN ?? '';
const PROJECT = env.LD_PROJECT_KEY || 'default';
const ENVIRONMENT = env.LD_ENVIRONMENT_KEY || 'production';
const CLIENT_SIDE_ID = env.VITE_LD_CLIENT_SIDE_ID ?? '';
const SDK_KEY = env.LD_SDK_KEY ?? '';
// Override for LaunchDarkly's EU or federal instances (for example https://app.eu.launchdarkly.com).
const API = `${(env.LD_API_URL || 'https://app.launchdarkly.com').replace(/\/$/, '')}/api/v2`;

class ApiError extends Error {
  constructor(status, body, label) {
    super(`${label} failed with HTTP ${status}: ${body?.message ?? JSON.stringify(body)}`);
    this.status = status;
  }
}

async function api(method, path, { body, contentType = 'application/json', label = `${method} ${path}` } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: TOKEN,
      'LD-API-Version': API_VERSION,
      ...(body ? { 'Content-Type': contentType } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data, label);
  return data;
}

async function getOrNull(path) {
  try {
    return await api('GET', path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function step(message) {
  console.log(`\n> ${message}`);
}

function printPlan() {
  console.log(`Dry run: project "${PROJECT}", environment "${ENVIRONMENT}". Nothing is sent to LaunchDarkly.`);
  step(`Flag ${HERO_FLAG.key}: create if missing, boolean, available to client-side SDKs`);
  step(`Segment ${BETA_SEGMENT.key}: create if missing, then set its rules to:`);
  console.log(JSON.stringify(BETA_SEGMENT.rules, null, 2));
  step(`Flag targeting in ${ENVIRONMENT} (semantic patch):`);
  console.log(JSON.stringify(heroTargetingInstructions({ trueId: '<true variation id>', falseId: '<false variation id>' }), null, 2));
  for (const metric of CHECKOUT_METRICS) {
    step(`Metric ${metric.key}: create if missing`);
    console.log(JSON.stringify(metric, null, 2));
  }
  step(`Model configs: create ${Object.values(MODELS).map((m) => m.key).join(', ')} if the project lacks them`);
  step(`AgentControl config ${AI_CONFIG.key}: create if missing (mode ${AI_CONFIG.mode}), then create or update its variations:`);
  for (const v of VARIATIONS) console.log(`  ${v.key}: ${JSON.stringify({ ...variationBody(v), messages: '[system prompt, see scripts/ld-ai-config.mjs]' })}`);
  step(`AgentControl targeting in ${ENVIRONMENT}: default rule serves "${DEFAULT_VARIATION_KEY}"`);
  step(`Metric ${RECOMMENDED_PRODUCT_METRIC.key}: create if missing`);
  console.log(JSON.stringify(RECOMMENDED_PRODUCT_METRIC, null, 2));
  for (const metric of BASKET_METRICS) {
    step(`Metric ${metric.key}: create if missing`);
    console.log(JSON.stringify(metric, null, 2));
  }
}

/** Creates a metric if the project does not have it yet. Metrics are project-wide, not per environment. */
async function ensureMetric(metric) {
  step(`Metric ${metric.key}`);
  if (await getOrNull(`/metrics/${PROJECT}/${metric.key}`)) {
    console.log('  Already exists.');
    return;
  }
  await api('POST', `/metrics/${PROJECT}`, { label: `Create metric ${metric.key}`, body: metric });
  console.log(`  Created (custom ${metric.isNumeric ? `value, ${metric.unit}` : 'conversion, binary'}, event "${metric.eventKey}").`);
}

/** True when an existing variation already has this prompt and model, so a rerun changes nothing. */
function variationMatches(existing, body) {
  const prompt = existing?.messages?.find((m) => m.role === 'system')?.content;
  const modelKey = existing?.modelConfigKey;
  return prompt === body.messages[0].content && modelKey === body.modelConfigKey && existing?.name === body.name;
}

async function setupAssistant() {
  const base = `/projects/${PROJECT}/ai-configs`;

  step('Model configs (Anthropic Claude)');
  const known = new Set(((await getOrNull(`${base}/model-configs`)) ?? []).map?.((m) => m.key) ?? []);
  for (const model of Object.values(MODELS)) {
    if (known.has(model.key)) {
      console.log(`  ${model.key}: available.`);
      continue;
    }
    try {
      await api('POST', `${base}/model-configs`, {
        label: `Create model config ${model.key}`,
        body: {
          key: model.key,
          id: model.id,
          name: model.name,
          provider: 'Anthropic',
          costPerInputToken: model.costPerInputToken,
          costPerOutputToken: model.costPerOutputToken,
        },
      });
      console.log(`  ${model.key}: created as a custom model config.`);
    } catch (error) {
      // Keys of LaunchDarkly's global catalog models are reserved: that means it already exists.
      if (error instanceof ApiError && (error.status === 400 || error.status === 409)) console.log(`  ${model.key}: provided by LaunchDarkly.`);
      else throw error;
    }
  }

  step(`AgentControl config ${AI_CONFIG.key}`);
  if (!(await getOrNull(`${base}/${AI_CONFIG.key}`))) {
    await api('POST', base, { label: 'Create AgentControl config', body: AI_CONFIG });
    console.log('  Created.');
  } else {
    console.log('  Already exists.');
  }

  for (const variation of VARIATIONS) {
    const body = variationBody(variation);
    const existing = await getOrNull(`${base}/${AI_CONFIG.key}/variations/${variation.key}`);
    // The response lists every version of the variation; compare against the newest.
    const latest = (existing?.items ?? []).reduce((a, b) => ((b.version ?? 0) > (a?.version ?? 0) ? b : a), undefined);
    if (!existing) {
      await api('POST', `${base}/${AI_CONFIG.key}/variations`, { label: `Create variation ${variation.key}`, body: { key: variation.key, ...body } });
      console.log(`  Variation ${variation.key}: created.`);
    } else if (variationMatches(latest, body)) {
      console.log(`  Variation ${variation.key}: up to date.`);
    } else {
      await api('PATCH', `${base}/${AI_CONFIG.key}/variations/${variation.key}`, { label: `Update variation ${variation.key}`, body });
      console.log(`  Variation ${variation.key}: updated (new version). If an experiment is running on this config, restart it.`);
    }
  }

  step(`AgentControl targeting in ${ENVIRONMENT}`);
  const targeting = await api('GET', `${base}/${AI_CONFIG.key}/targeting`);
  const control = VARIATIONS.find((v) => v.key === DEFAULT_VARIATION_KEY);
  const controlId = targeting.variations?.find(
    (v) => v.name === control.name || v.value?._ldMeta?.variationKey === control.key || v.value?.key === control.key,
  )?._id;
  if (!controlId) throw new Error(`Could not find the "${control.name}" variation in ${AI_CONFIG.key}'s targeting.`);
  const fallthrough = targeting.environments?.[ENVIRONMENT]?.fallthrough;
  if (fallthrough?.rollout) {
    // An experiment or percentage rollout owns the default rule; leave it alone.
    console.log('  Default rule is a percentage split (an experiment or rollout). Left unchanged.');
  } else {
    await api('PATCH', `${base}/${AI_CONFIG.key}/targeting`, {
      label: 'Update AgentControl targeting',
      contentType: 'application/json; domain-model=launchdarkly.semanticpatch',
      body: {
        environmentKey: ENVIRONMENT,
        comment: 'Default rule serves Control (npm run ld:setup, scripts/ld-ai-config.mjs)',
        instructions: [{ kind: 'updateFallthroughVariationOrRollout', variationId: controlId }],
      },
    });
    // LaunchDarkly points a new config's default rule at the first variation created
    // (Control here); setting it explicitly keeps the result independent of creation order.
    console.log(`  Default rule -> ${control.name}.`);
  }

  if (targeting.environments?.[ENVIRONMENT]?.enabled === false) {
    // The REST API has no "turn on" instruction for AgentControl targeting.
    console.log(`  NOTE: targeting is Off in ${ENVIRONMENT}, so everyone gets the fallback. Turn it On in Agent management > Configs > ${AI_CONFIG.name} > Targeting.`);
  }

  await ensureMetric(RECOMMENDED_PRODUCT_METRIC);
  for (const metric of BASKET_METRICS) await ensureMetric(metric);
}

async function main() {
  if (DRY_RUN) return printPlan();

  if (!TOKEN) {
    console.error('LD_API_TOKEN is not set.');
    console.error('Create one in LaunchDarkly: gear icon > Settings > Authorization > Create token (role: Writer),');
    console.error('then add it to the repo-root .env file as LD_API_TOKEN=... (never commit it).');
    process.exit(1);
  }

  step(`Checking project "${PROJECT}", environment "${ENVIRONMENT}"`);
  const environment = await getOrNull(`/projects/${PROJECT}/environments/${ENVIRONMENT}`);
  if (!environment) {
    throw new Error(`Environment "${ENVIRONMENT}" was not found in project "${PROJECT}". Set LD_PROJECT_KEY and LD_ENVIRONMENT_KEY in .env.`);
  }
  // An environment's _id is its client-side ID: check the app talks to this environment.
  if (CLIENT_SIDE_ID && environment._id !== CLIENT_SIDE_ID) {
    // Client-side IDs begin with a creation timestamp, so environments created together
    // share the same first characters. Name the environment the ID really belongs to.
    const all = await getOrNull(`/projects/${PROJECT}/environments`);
    const owner = all?.items?.find((e) => e._id === CLIENT_SIDE_ID);
    console.error(`  The app's VITE_LD_CLIENT_SIDE_ID does not belong to "${ENVIRONMENT}".`);
    console.error(
      owner
        ? `  It belongs to "${owner.name}". Set LD_ENVIRONMENT_KEY=${owner.key} in .env and run this again.`
        : `  It belongs to no environment in project "${PROJECT}". Check LD_PROJECT_KEY and VITE_LD_CLIENT_SIDE_ID.`,
    );
    console.error('  Nothing was changed, because the app would not see these changes.');
    console.error('  (Environments created together have IDs that start with the same characters; compare the whole ID.)');
    process.exit(1);
  } else {
    console.log(`  Found "${environment.name}"${CLIENT_SIDE_ID ? ', and it matches the app\'s client-side ID' : ''}.`);
  }
  // The assistant's server SDK key must belong to the same environment, or its
  // configs, metrics, and experiment data land in a different environment.
  // The keys are compared, never printed.
  if (SDK_KEY && environment.apiKey && SDK_KEY !== environment.apiKey) {
    const all = await getOrNull(`/projects/${PROJECT}/environments`);
    const owner = all?.items?.find((e) => e.apiKey === SDK_KEY);
    console.error(`  WARNING: LD_SDK_KEY (the assistant's server-side key) does not belong to "${ENVIRONMENT}".`);
    console.error(
      owner
        ? `  It belongs to "${owner.name}", so the assistant's answers and metrics go there. Copy ${environment.name}'s SDK key into .env and Vercel.`
        : '  It belongs to no environment in this project. Copy the SDK key from the same environment as the client-side ID.',
    );
  } else if (SDK_KEY && environment.apiKey) {
    console.log('  LD_SDK_KEY (server side) belongs to the same environment.');
  }

  step(`Flag ${HERO_FLAG.key}`);
  let flag = await getOrNull(`/flags/${PROJECT}/${HERO_FLAG.key}?env=${ENVIRONMENT}`);
  if (!flag) {
    flag = await api('POST', `/flags/${PROJECT}`, {
      label: 'Create flag',
      body: {
        ...HERO_FLAG,
        defaults: { onVariation: 1, offVariation: 1 },
        clientSideAvailability: { usingEnvironmentId: true, usingMobileKey: false },
        temporary: true,
      },
    });
    console.log('  Created.');
  } else {
    console.log('  Already exists.');
    if (!flag.clientSideAvailability?.usingEnvironmentId) {
      await api('PATCH', `/flags/${PROJECT}/${HERO_FLAG.key}`, {
        label: 'Turn on client-side availability',
        body: [
          {
            op: 'replace',
            path: '/clientSideAvailability',
            value: { usingEnvironmentId: true, usingMobileKey: flag.clientSideAvailability?.usingMobileKey ?? false },
          },
        ],
      });
      console.log('  Turned on "Available on client-side SDKs".');
    }
  }
  const trueId = flag.variations.find((v) => v.value === true)?._id;
  const falseId = flag.variations.find((v) => v.value === false)?._id;
  if (!trueId || !falseId) throw new Error(`${HERO_FLAG.key} must be a boolean flag with true and false variations.`);

  step(`Segment ${BETA_SEGMENT.key}`);
  const segmentPath = `/segments/${PROJECT}/${ENVIRONMENT}/${BETA_SEGMENT.key}`;
  if (!(await getOrNull(segmentPath))) {
    await api('POST', `/segments/${PROJECT}/${ENVIRONMENT}`, {
      label: 'Create segment',
      body: { key: BETA_SEGMENT.key, name: BETA_SEGMENT.name, description: BETA_SEGMENT.description },
    });
    console.log('  Created.');
  } else {
    console.log('  Already exists.');
  }
  await api('PATCH', segmentPath, {
    label: 'Set segment rules',
    body: [{ op: 'replace', path: '/rules', value: BETA_SEGMENT.rules }],
  });
  console.log('  Rule set: betaTester is one of true.');

  step(`Targeting for ${HERO_FLAG.key} in ${ENVIRONMENT}`);
  await api('PATCH', `/flags/${PROJECT}/${HERO_FLAG.key}`, {
    label: 'Update targeting',
    contentType: 'application/json; domain-model=launchdarkly.semanticpatch',
    body: {
      environmentKey: ENVIRONMENT,
      comment: 'Part 2 targeting applied by npm run ld:setup (scripts/ld-targeting.mjs)',
      instructions: heroTargetingInstructions({ trueId, falseId }),
    },
  });
  console.log(`  Individual target: ${HERO_TARGETING.individualTargets.join(', ')} -> true`);
  HERO_TARGETING.rules.forEach((rule, i) => console.log(`  Rule ${i + 1}: ${rule.description} -> true`));
  console.log('  Default rule -> false. Flag is On.');

  // Part 1 metrics on the checkout-completed event (scripts/ld-metrics.mjs).
  for (const metric of CHECKOUT_METRICS) await ensureMetric(metric);

  await setupAssistant();

  console.log('\nDone. Open the store, expand the Release Console, and switch personas.');
  console.log('Then open the Trail guide and ask a question. To start the experiment, see the README (Extra credit: AI Configs).');
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  if (error instanceof ApiError && error.status === 401) console.error('The API token is missing or invalid.');
  if (error instanceof ApiError && error.status === 403) console.error('The API token needs the Writer role (or a custom role that can edit flags, segments, AgentControl configs, and metrics).');
  process.exit(1);
});
