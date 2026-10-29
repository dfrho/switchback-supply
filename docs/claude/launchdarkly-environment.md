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

Default rule serves `false` unless the user is demonstrating a release. Optional individual target `qa-tester-001` serves `true` (README Step 5). A **Generic flag trigger** with action "turn the flag off" exists for this environment; its URL is in `.env` as `LD_TRIGGER_URL_CHECKOUT_OFF`, and `npm run remediate` calls it. Resetting the trigger issues a new URL.

### `release-landing-hero` targeting (Test), applied by `npm run ld:setup`

| Order | Section | Condition | Serves |
|---|---|---|---|
| 1 | Individual target | context key `qa-tester-001` | `true` |
| 2 | Rule "Employees" | `email` ends with `@switchbacksupply.test` (private attribute) | `true` |
| 3 | Rule "Beta shoppers" | is in segment `beta-shoppers` | `true` |
| 4 | Rule "Gold members in Central states" | `loyaltyTier` is one of `gold` AND `state` is one of `TN, TX, IL, MN, CO` | `true` |
| 5 | Default rule | everyone else | `false` |

Source of truth: `scripts/ld-targeting.mjs`. The Release Console labels come from `HERO_TARGETING` in `web/src/launchdarkly/config.ts`.

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

Every context also carries `country: US` and a detected `deviceType`. The console's toggles and selects edit the current shopper's attributes and call `identify()`; they never change rules.

## Credentials (names only)

| Variable | Where | Purpose |
|---|---|---|
| `VITE_LD_CLIENT_SIDE_ID` | `.env`, Vercel | Browser SDK (public by design) |
| `LD_TRIGGER_URL_CHECKOUT_OFF` | `.env` | `npm run remediate` |
| `LD_API_TOKEN` | `.env` | `npm run ld:setup` (personal token, Writer role, expires January 2027) |
| `LD_PROJECT_KEY`, `LD_ENVIRONMENT_KEY` | `.env` | `default`, `test` |
| `LD_SDK_KEY`, `ANTHROPIC_API_KEY` | `.env`, Vercel server env (planned) | Extra credit 2 server route |
