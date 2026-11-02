# LaunchDarkly account state

What exists in the LaunchDarkly trial account that backs this app. Keep this file current when flags, segments, triggers, or environments change. It contains no secrets: client-side IDs, SDK keys, API tokens, and trigger URLs live only in the user's `.env` and in Vercel.

## Project and environments

| Item | Value |
|---|---|
| Project name / key | Switchback Supply / `default` |
| Environments | `production` and `test` |
| **Environment the app uses** | **`test`** (its client-side ID is in `.env` as `VITE_LD_CLIENT_SIDE_ID`, and `.env` sets `LD_ENVIRONMENT_KEY=test`) |
| Trial | 14 days from October 27, 2026 (ends around November 10, 2026); includes Enterprise and Guardian features |

Production also holds a copy of the Part 2 targeting from an early `ld:setup` run. It is harmless but unused. Production's and Test's client-side IDs share their first eight characters (a creation timestamp); always compare whole IDs.

## Flags

| Key | Type | Variations | Off variation | Client-side | Used by |
|---|---|---|---|---|---|
| `release-new-checkout` | Boolean | `true` Express checkout, `false` Classic checkout | `false` | On | `CheckoutDrawer.tsx` (Part 1) |
| `release-landing-hero` | Boolean | `true` Winter-Ready hero, `false` current hero | `false` | On | `LandingHero.tsx` (Part 2) |

### `release-new-checkout` targeting (Test)

As of November 2, 2026: display name **Release new checkout** (renamed from `release-new-checkout`; key unchanged). **On** in Test during the review period, so reviewers see Express checkout; turn it **Off** 30 minutes before the demo, so turning it On is the live release. Default rule serves `true`, no individual targets. README Step 5's optional `qa-tester-001` target is not currently set. The live site (Vercel) uses this environment, and the dashboard showed its evaluations arriving. A **Generic flag trigger** with action "turn the flag off" exists for this environment; its URL is in `.env` as `LD_TRIGGER_URL_CHECKOUT_OFF`, and `npm run remediate` calls it. Resetting the trigger issues a new URL.

Part 1 metrics (added October 30, 2026, branch `feat/checkout-metric`): the drawer sends `checkout-completed` with the order total as its value; `ld:setup` defines `checkout-completed` (conversion) and `checkout-order-value` (value, dollars, averaged per shopper, shoppers without an order count as $0). Created in Test's project by `ld:setup` on October 30, 2026; not yet attached to an experiment or rollout.

### `release-landing-hero` targeting (Test), applied by `npm run ld:setup`

| Order | Section | Condition | Serves |
|---|---|---|---|
| 1 | Individual target | context key `qa-tester-001` | `true` |
| 2 | Rule "Employees" | `email` ends with `@switchbacksupply.test` (private attribute) | `true` |
| 3 | Rule "Beta shoppers" | is in segment `beta-shoppers` | `true` |
| 4 | Rule "Gold members in Central states" | `loyaltyTier` is one of `gold` AND `state` is one of `TN, TX, IL, MN, CO` | `true` |
| 5 | Default rule | everyone else | `false` |

Source of truth: `scripts/ld-targeting.mjs`. The Release Console labels come from `HERO_TARGETING` in `web/src/launchdarkly/config.ts`.

## AgentControl config (extra credit, AI Configs)

Created by `npm run ld:setup` on October 29, 2026 (definition: `scripts/ld-ai-config.mjs`). AgentControl configs are project-wide; LaunchDarkly set the default rule to Control in both environments (the first variation created), and `ld:setup` set Test explicitly. Verified live in Test, locally and on the Vercel preview: Control answers on Claude Haiku 5.5, Monitoring shows requests, tokens, and cost (cost appears in the dashboard; the REST metrics endpoint reports cost as 0).

Production also holds 3 early test answers and 1 thumbs up from before `LD_SDK_KEY` was corrected (it was Production's key). Harmless; ignore them.

| Item | Value |
|---|---|
| Config | `shopping-assistant`, Completion mode |
| Variations | `control` (Claude Haiku 5.5, guide prompt), `best-pick` (Haiku 5.5, best-pick prompt), `sonnet` (Claude Sonnet 5.5, guide prompt), `bundle` (Haiku 5.5, kit prompt, created by `ld:setup` October 30, 2026); parameters `max_tokens` 1024, `effort` low |
| Default rule | Control (until the experiment takes over the default rule) |
| Metrics | `assistant-recommended-product` (conversion). Created by `ld:setup` October 30, 2026 for the kit experiment: `assistant-free-shipping-basket` (conversion, primary), `assistant-basket-value` (value, dollars, $0 when nothing is recommended), `assistant-response-time` (value, milliseconds, lower is better, shoppers without events excluded). All sent server-side |
| Experiment | "Trail guide: kit prompt vs larger model" (Test, renamed from "Trail guide: prompt vs model"). Iteration 1 (Control, best-pick, Sonnet; primary `assistant-recommended-product`) stopped October 30, 2026 shipping Control: the metric saturated near 99%; not reported in the README (David's decision). Iteration 2 was saved with the wrong metrics and replaced. **Iteration 3** (running): Control, Sonnet, `bundle` at about 33% each; primary `assistant-free-shipping-basket`, plus kit value, response time (guardrail), recommended a product; Bayesian 95%. Shoppers 1100 to 1999 (311 / 297 / 292), no SRM; LaunchDarkly names Sonnet the winner. Results in the README. Earlier shopper ranges: 1 to 940 (iteration 1 and a 30-reply check), 941 to 970 (smoke), 971 to 1099 (iteration 2). Next shopper number: 2000 |

## Segment

`beta-shoppers` (Test, rule-based): context kind `user`, `betaTester` is one of `true` (boolean).

## Personas (Release Console "Shopping as")

| Persona | Context key | Attributes | Hero result |
|---|---|---|---|
| Guest shopper | random `guest-...` (anonymous, stored in localStorage) | tier `none` | Default rule, current hero |
| Internal QA tester | `qa-tester-001` | tier `none`, WA | Individual target |
| Employee | `employee-001` | email `merch@switchbacksupply.test`, silver, CA | Rule 1 |
| Beta tester, Seattle | `shopper-beta-001` | silver, WA, `betaTester: true` | Rule 2 |
| Gold member, Nashville | `shopper-gold-001` | gold, TN | Rule 3 |

Every context also carries `country: US` and a detected `deviceType`. The console's toggles and selects edit the current shopper's attributes and call `identify()`; they never change rules. An edited shopper shows **· edited** and a **Reset** link, which re-chooses the persona and restores its attributes.

## Credentials (names only)

| Variable | Where | Purpose |
|---|---|---|
| `VITE_LD_CLIENT_SIDE_ID` | `.env`, Vercel | Browser SDK (public by design) |
| `LD_TRIGGER_URL_CHECKOUT_OFF` | `.env` | `npm run remediate` |
| `LD_API_TOKEN` | `.env` | `npm run ld:setup` (personal token, Writer role, expires January 2027) |
| `LD_PROJECT_KEY`, `LD_ENVIRONMENT_KEY` | `.env` | `default`, `test` |
| `LD_SDK_KEY`, `ANTHROPIC_API_KEY` | `.env`, Vercel (Secret) | `/api/assistant` (server only) |
