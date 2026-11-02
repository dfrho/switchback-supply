# Roadmap

Status as of November 2, 2026. Work in this order. Each item is its own branch and PR.

## Done

| PR | What |
|---|---|
| #1 | Part 1: Release and Remediate (flagged checkout, change listener, trigger script, Release Console) |
| #2 | Storefront: 25-product catalog, product pages, variant cart |
| #3 | README demo walkthrough around an open checkout drawer |
| #4 | Test suite: Vitest, Playwright, mock LaunchDarkly, CI |
| #5 | Part 2: Target (Winter-Ready hero, contexts, individual and rule-based targeting, segment, evaluation reasons, `npm run ld:setup`) |
| #6 | README phone layout notes |
| #7 | Claude Code guidance: CLAUDE.md, rules, and roadmap |
| #8 | Vercel deploy: live at https://web-puce-kappa-92.vercel.app (Test client-side ID) |
| #9 | Extra credit: AgentControl shopping assistant on Claude, experiment iteration 1 |
| #10 | Checkout metrics for `release-new-checkout`; model refusals tracked as errors |
| #11 | Experiment iteration 2 design: kit prompt variation, free-shipping kit, kit value, and response-time metrics |
| #12 | Demo runbook (since removed from the repo; kept locally and git-ignored) |
| next | Experiment results in the README |

Dropped by decision on October 29: the observability plus guarded rollout extra credit (not in the brief). The README mentions guarded rollouts only as the next rung of the remediation ladder.

## 1. Extra credit: AgentControl (AI Configs) shopping assistant, with an experiment

Branch `feat/ai-shopping-assistant` (code done October 29; awaiting live verification, `ld:setup` run, and experiment start). Target: experiment traffic running by Friday October 30.

Decisions:
- Stable SDK: `@launchdarkly/server-sdk-ai` v2 (maintenance mode) with `@launchdarkly/node-server-sdk` and `@anthropic-ai/sdk`. Map messages to Anthropic and call the tracker manually. The README names the beta `@launchdarkly/ai-node` plus `@launchdarkly/ai-claude-messages` as the direction (open beta, auto metrics, no fallback argument, no documented feedback API).
- Catalog gear advisor: grounded in `data/catalog.json` through a compact `{{catalog}}` prompt variable; recommends products as `/products/<id>` links that the server validates against the catalog.
- Completion mode config `shopping-assistant`, four variations: Control (Haiku 5.5, guide prompt), Treatment A (Haiku 5.5, best-pick prompt), Treatment B (Sonnet 5.5, guide prompt), Treatment C `bundle` (Haiku 5.5, kit prompt, added for iteration 2). Each treatment changes one thing.
- Anthropic API version 2026-10-21 rejects `temperature`, `top_p`, `top_k` on current models and requires `max_tokens`: forward only `max_tokens` (read `max_tokens` or `maxTokens`).
- Observed October 29: a new config's default rule pointed at the first variation created (Control), in every environment, not at "disabled" as one research source claimed. Setup still sets it explicitly.
- Observed October 29: the first live answers landed in Production because `LD_SDK_KEY` was Production's key; `ld:setup` now warns about this.
- Feedback: tracker `resumptionToken` stays server-side inside an HMAC-signed token; `aiClient.createTracker(token, context).trackFeedback(...)`.
- Experiment metric: custom conversion `assistant-recommended-product`, sent server-side when a real reply links at least one real catalog product. Synthetic shoppers (`scripts/assistant-traffic.mjs`, keys `synthetic-shopper-NNNN`, `trafficSource: synthetic`) ask real questions and get real Claude replies; no behavior is faked. About 300 conversations per variation.
- Vercel: `api/assistant.ts` and `api/assistant-feedback.ts` (`export default { fetch }`), shared code in `server/`, Node SDK singleton, `waitForInitialization({ timeout })` in try/catch, `waitUntil(flush())` from `@vercel/functions`. Local dev: Vite middleware routes `/api/assistant*` to the same handlers.
- Keys: `LD_SDK_KEY` and `ANTHROPIC_API_KEY` in Vercel (Secret) and `.env`, never `VITE_`. `LD_API_TOKEN` stays local only.
- Setup as code: extend `npm run ld:setup` (config, variations, custom model configs if needed, fallthrough, metric). Check request bodies against `https://app.launchdarkly.com/api/openapi.json`. The experiment itself is created in the dashboard (README steps).
- Docs: https://launchdarkly.com/docs/home/agentcontrol, https://launchdarkly.com/docs/sdk/ai/node-js-legacy, https://launchdarkly.com/docs/sdk/features/ai-metrics, https://launchdarkly.com/docs/api/agentcontrol

Done when: chat panel on every page, a prompt or model change in LaunchDarkly changes the next reply with no redeploy, turning the config off serves the fallback, Monitoring shows tokens, duration, generations, and satisfaction, tests (Anthropic and LaunchDarkly faked), README section with setup and doc links.

## 2. Experiment results

Iteration 1 (recommended-a-product metric) saturated near 99%; LaunchDarkly picked Sonnet by 1.5 points, which does not justify its cost. Not reported in the README (David's decision); the story is in his private interview notes.

Kit experiment (PR #11): ran as iteration 3, shoppers 1100 to 1999, October 30, 2026. LaunchDarkly names Sonnet the winner on free-shipping kits; Scorecard (November 2, from LaunchDarkly): Sonnet wins the primary metric but fails the response-time guardrail (+48%, 95% interval +41% to +56%); the kit prompt fails both (+21% slower). Decision: keep Control as default; release Sonnet to gold-tier shoppers behind a guarded rollout watching add-to-cart and response time, widen only if purchases rise.

## 3. Demo runbook and rehearsal

Runbook written October 30, 2026; removed from the repo November 2, 2026 and kept as a private, git-ignored local file. Rehearsal still to do.

- A one-page private runbook: pre-demo checklist (clean browser profile without ad blockers, flags in the expected starting state, trial still active), the Part 1 walkthrough, the Part 2 persona walkthrough, the AI assistant and experiment, and recovery steps.
- Rehearse end to end against the live Vercel URL before submission.

## Submission

Due Monday, November 2, 2026, end of day. Public repo with detailed setup instructions, code comments for keys and flags to recreate, and the live URL.
