#!/usr/bin/env node
/**
 * SYNTHETIC SHOPPERS FOR THE AI CONFIGS EXPERIMENT
 *
 * An experiment needs hundreds of conversations per variation before its
 * results mean anything, and a demo store has no real shoppers. This script
 * plays those shoppers: each one asks a realistic gear question through the
 * store's own /api/assistant endpoint, so every answer is a real Claude reply
 * from whichever variation LaunchDarkly assigned, and the experiment metric is
 * measured from that real reply. Nothing about the outcome is simulated; only
 * the shoppers are.
 *
 * Every synthetic shopper is labeled: key "synthetic-shopper-NNNN" and the
 * context attribute trafficSource = "synthetic".
 *
 * COST: every conversation is a paid model call. The script prints an estimate
 * before it starts. Set a spend limit in the Anthropic Console first.
 *
 * Usage:
 *   node scripts/assistant-traffic.mjs --dry-run
 *   node scripts/assistant-traffic.mjs --base-url http://localhost:5173 --count 10
 *   node scripts/assistant-traffic.mjs --base-url https://your-site.vercel.app --count 900 --start 1
 *
 * Options:
 *   --base-url     Store to call (default http://localhost:5173, the dev server)
 *   --count        Conversations to run (default 10)
 *   --start        First shopper number (default 1). Use a new range for each run so
 *                  shoppers are not reused (LaunchDarkly keeps each key in one variation).
 *   --concurrency  Requests in flight at once (default 2)
 *   --dry-run      Print the plan and the cost estimate, call nothing
 */

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE_URL = option('base-url', 'http://localhost:5173').replace(/\/$/, '');
const COUNT = Number(option('count', '10'));
const START = Number(option('start', '1'));
const CONCURRENCY = Number(option('concurrency', '2'));
const DRY_RUN = flag('dry-run');

// Prices for the summary's kit totals. The server measures the real metric the same way.
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const PRICES = new Map(catalog.products.map((p) => [p.id, p.price]));
const FREE_SHIPPING_MIN = 150;
const kitValue = (ids = []) => ids.reduce((sum, id) => sum + (PRICES.get(id) ?? 0), 0);

/** Real questions a shopper might ask an outdoor store. Some have a clear catalog answer; some do not. */
const QUESTIONS = [
  'Two nights in Colorado in October. What should I pack?',
  'Which headlamp is best for under $60?',
  'Do I need a water filter for long day hikes?',
  'I am starting to backpack. What pack size should I get?',
  'What boots work for rocky trails in the rain?',
  'I get cold at camp at night. What would help?',
  'Gift ideas for a hiker for under $75?',
  'What do I need for my first overnight trip?',
  'Best rain jacket for a week in the Pacific Northwest?',
  'Lightweight tent for two people?',
  'Do trekking poles actually help on steep descents?',
  'What should I bring for a summer day hike in Texas?',
  'I need a stove for quick dinners on the trail.',
  'Planning a winter day hike in Minnesota. What gear matters most?',
  'What sleeping bag is warm enough for 25 degrees?',
  'Something to carry water on a trail run?',
  'Is a 45 liter pack too big for weekend trips?',
  'What lighting do I need around camp?',
  'Car camping with kids. What should we buy first?',
  'Best way to treat stream water on a thru-hike?',
  'My boots give me blisters on long days. Any better options?',
  'Do you sell anything for fishing?',
  'Kayaking gear?',
  'What is the warmest jacket you carry?',
  'I want to cut pack weight for a long trail. Where do I start?',
  'Chair for sitting around the campfire?',
  'What should go in a basic day pack?',
  'Hiking in Illinois in spring mud. Footwear?',
  'Headlamp with a red light so I do not wake my tent mate?',
  'Under $150 for a first backpacking kit, what can I get?',
  'Weekend in the Tennessee mountains in November. What do I pack?',
  'Do I need a shell if I already have a puffer?',
  'What is good for a sunrise summit hike?',
  'Need a bottle that keeps water cold all day.',
  'Is your tent freestanding?',
  'Rainy shoulder season camping. What keeps me dry?',
  'Something for a hiker who has everything?',
  'Best gear for a quick overnight in the desert?',
  'What should I upgrade first, boots or pack?',
  'Do you carry bear canisters?',
];

const TIERS = ['none', 'none', 'silver', 'gold'];
const STATES = ['TN', 'TX', 'IL', 'MN', 'CO', 'CA', 'NY', 'WA'];

/** Deterministic per shopper number, so reruns of a range ask the same things. */
function shopperFor(n) {
  return {
    key: `synthetic-shopper-${String(n).padStart(4, '0')}`,
    anonymous: false,
    name: `Synthetic shopper ${n}`,
    loyaltyTier: TIERS[n % TIERS.length],
    state: STATES[(n * 7) % STATES.length],
    country: 'US',
    deviceType: n % 3 === 0 ? 'mobile' : 'desktop',
    betaTester: false,
    trafficSource: 'synthetic',
  };
}

/**
 * Rough cost per conversation, assuming the three variations split traffic evenly:
 * about 2,000 input tokens (prompt plus catalog) and 500 output tokens (thinking plus answer).
 * Prices in USD per million tokens, Claude Haiku 5.5 and Claude Sonnet 5.5.
 */
function estimateCost(count) {
  const perCall = (inPrice, outPrice) => (2000 * inPrice + 500 * outPrice) / 1e6;
  const average = (2 * perCall(0.1, 0.5) + perCall(2, 10)) / 3;
  return count * average;
}

async function ask(n) {
  const shopper = shopperFor(n);
  const message = QUESTIONS[(n * 13) % QUESTIONS.length];
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/api/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, shopper }),
  });
  const body = await res.json().catch(() => ({}));
  return { n, status: res.status, ms: Date.now() - started, ...body };
}

async function main() {
  console.log(`Synthetic shoppers ${START} to ${START + COUNT - 1} against ${BASE_URL}`);
  console.log(`Estimated model cost: about $${estimateCost(COUNT).toFixed(2)} (real Claude calls).`);
  if (DRY_RUN) {
    console.log('\nDry run. First three requests:');
    for (let n = START; n < START + Math.min(3, COUNT); n++) {
      console.log(`  ${shopperFor(n).key}: "${QUESTIONS[(n * 13) % QUESTIONS.length]}"`);
    }
    return;
  }

  const results = [];
  let next = START;
  async function worker() {
    while (next < START + COUNT) {
      const n = next++;
      try {
        const r = await ask(n);
        results.push(r);
        const label = r.source === 'claude' ? `${r.variation}, ${r.products.length} product(s), kit $${kitValue(r.products)}` : r.source ?? `HTTP ${r.status}`;
        console.log(`  #${n} ${label}, ${r.ms} ms`);
      } catch (error) {
        results.push({ n, source: 'network' });
        console.log(`  #${n} failed: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log('\nBy variation (as this script saw it; LaunchDarkly computes the real results):');
  const byVariation = {};
  for (const r of results) (byVariation[r.source === 'claude' ? r.variation : `(${r.source ?? 'error'})`] ??= []).push(r);
  for (const [variation, rows] of Object.entries(byVariation)) {
    const recommended = rows.filter((r) => r.products?.length > 0).length;
    const avgMs = Math.round(rows.reduce((sum, r) => sum + (r.ms ?? 0), 0) / rows.length);
    const shipsFree = rows.filter((r) => kitValue(r.products) >= FREE_SHIPPING_MIN).length;
    const avgKit = Math.round(rows.reduce((sum, r) => sum + kitValue(r.products), 0) / rows.length);
    const pct = (part) => Math.round((100 * part) / rows.length);
    console.log(
      `  ${variation}: ${rows.length} answers, ${recommended} recommended a product (${pct(recommended)}%), ` +
        `kit ships free ${shipsFree} (${pct(shipsFree)}%), avg kit $${avgKit}, avg ${avgMs} ms`,
    );
  }
  if (results.every((r) => r.source !== 'claude')) {
    console.log('\nNo model answers. Check that the AgentControl config exists and is On, and that LD_SDK_KEY and ANTHROPIC_API_KEY are set where the store runs.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
