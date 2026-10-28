#!/usr/bin/env node
/**
 * PART 2 SETUP, AS CODE
 *
 * Creates or updates everything Part 2 needs in one LaunchDarkly environment:
 *   1. The release-landing-hero flag (boolean, available to client-side SDKs)
 *   2. The beta-shoppers segment (betaTester is one of true)
 *   3. The hero's targeting: individual target, three rules in order, default false, flag On
 *
 * It is safe to run again: it replaces targeting instead of appending to it.
 *
 * Why a script? LaunchDarkly's dashboard offers only attributes it has already
 * seen from an SDK, so a brand-new environment cannot pick betaTester, loyaltyTier,
 * or state from the dropdowns. The REST API has no such limit. It also makes the
 * configuration reviewable and repeatable, which is how larger teams manage
 * LaunchDarkly (often with the Terraform provider, which uses this same API).
 *
 * SETUP (repo-root .env, never committed):
 *   LD_API_TOKEN=        Organization settings > Authorization > Create token (role: Writer)
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
}

async function main() {
  if (DRY_RUN) return printPlan();

  if (!TOKEN) {
    console.error('LD_API_TOKEN is not set.');
    console.error('Create one in LaunchDarkly > Organization settings > Authorization (role: Writer),');
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

  console.log('\nDone. Open the store, expand the Release Console, and switch personas.');
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  if (error instanceof ApiError && error.status === 401) console.error('The API token is missing or invalid.');
  if (error instanceof ApiError && error.status === 403) console.error('The API token needs the Writer role (or a custom role that can edit flags and segments).');
  process.exit(1);
});
