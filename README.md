# Switchback Supply

**A LaunchDarkly sample app for a fictional outdoor gear retailer.** It shows how a team ships features faster without adding risk: release a new checkout to production behind a feature flag, test it there with internal users first, and roll it back in under a second when something goes wrong, with no deploy and no page reload.

Switchback Supply plays the role of "ABC Company" from the exercise brief. Each section is written for the persona the brief names, the way it would be handed to a prospective customer.

| Section | Persona | What it shows | Status |
|---|---|---|---|
| Storefront | All | 25-product catalog with color and size variants, product pages, a persistent cart | Done |
| **Part 1: Release and Remediate** | Engineering manager | Flag-wrapped checkout, live listener, test in production, flag trigger remediation | Done |
| **Part 2: Target** | Developer | Winter-Ready hero behind a flag, shopper contexts with attributes, individual and rule-based targeting | Done |
| Extra credit 1 | Engineering manager | Observability plus a guarded rollout that rolls itself back | Planned |
| Extra credit 2 | AI product manager | AgentControl (AI Configs) shopping assistant on Anthropic Claude | Planned |

---

## Part 1: Release and Remediate

### The business problem

Competitors are catching up, and leadership wants features shipped faster. Switchback Supply's reputation rests on quality, so speed cannot come at the cost of risk. The engineering manager needs three things:

1. **Test in production before customers see it.** Ship the code dark, then turn it on only for internal QA.
2. **Release instantly.** Flip a switch and every shopper gets the new experience, without a redeploy.
3. **Roll back instantly.** If a bug slips through, turn the feature off in seconds, ideally without anyone logging into anything.

### What you will see

A working outdoor gear store: 25 products across six categories, each with a product page, color and size pickers, live stock levels, and a cart that survives a page refresh. The store's checkout is wrapped in one boolean feature flag, `release-new-checkout`:

| Flag value | Checkout shoppers get |
|---|---|
| `false` (default, and the fallback if LaunchDarkly is unreachable) | **Classic checkout**: three steps (shipping, payment, review) |
| `true` | **Express checkout**: one page, saved address and card, one-tap order |

A **Release Console** in the bottom-left corner shows the SDK connection status, the flag's live value, who the SDK thinks you are, and a timestamped log written by the flag change listener. It starts collapsed so it never covers the store; click it to expand, and it remembers your choice. It exists only to make LaunchDarkly visible during a demo.

---

## Quick start

If you already have a LaunchDarkly account and the flag set up (steps 1 to 4 below):

```bash
git clone https://github.com/dfrho/switchback-supply.git
cd switchback-supply
cp .env.example .env        # then paste your client-side ID and trigger URL into .env
npm install
npm run dev                 # open http://localhost:5173
```

---

## Prerequisites and assumptions

- **Node.js 20.19 or newer** (`node -v` to check). Developed on Node 22.
- **npm 10 or newer** (bundled with Node).
- **macOS, Linux, or Windows with WSL or Git Bash.** The remediation script uses `bash` and `curl`, both standard on macOS and Linux.
- **A modern browser** (Chrome, Edge, Firefox, or Safari). Some ad or privacy blockers block requests to LaunchDarkly; if the console says "Timed out," allow `launchdarkly.com` for `localhost`.
- **A LaunchDarkly account.** A free trial works: [launchdarkly.com/start-trial](https://launchdarkly.com/start-trial/). Flag triggers are an Enterprise feature, which the trial includes.
- Port **5173** is free on your machine.

---

## Setup, step by step

### Step 1: Pick a LaunchDarkly project and environment

Any project works. These instructions use the **Test** environment. Whatever you choose, use the same environment in every step.

### Step 2: Copy your client-side ID

In LaunchDarkly, open **Settings > (your project) > (your environment) > SDK keys**. Under **Client-side IDs**, copy the ID.

The client-side ID is **not a secret**. It is designed to ship in browser code. Do not use the **SDK key** here: that one is secret and belongs only on servers.

### Step 3: Recreate the feature flag

Create a flag with **exactly** these settings:

| Setting | Value |
|---|---|
| Name | Release new checkout |
| Key | `release-new-checkout` |
| Type | Boolean (`true` / `false`) |
| Off variation | `false` |
| **Available on client-side SDKs** | **On** (in the flag's right sidebar, under Advanced controls) |
| Permanent flag | Off (this is a temporary release flag, to be removed after full rollout) |

> If "Available on client-side SDKs" is off, the browser silently receives the fallback value (`false`) and the flag will appear to do nothing. This is the most common setup mistake.

Leave the flag **Off** for now.

### Step 4: Create the remediation trigger

1. Open the flag, select your environment, and open the environment's **three-dot menu > Configuration in environment**.
2. In **Triggers**, click **Add trigger**.
3. Choose **Generic trigger**, set the action to **turn the flag off**, and save.
4. **Copy the URL immediately.** LaunchDarkly hides it once you leave the page. If you lose it, reset the trigger to get a new one.

Treat the trigger URL like a password: anyone who has it can turn the flag off.

### Step 5 (optional): Target the internal QA tester

To test in production, give QA the new checkout before anyone else:

1. Open the flag's **Targeting** tab in your environment.
2. Under **Individual targets**, add the context key `qa-tester-001` to the **true** variation.
3. Leave the default rule serving **false**, turn the flag **On**, and save.

Now only `qa-tester-001` sees Express checkout. Everyone else still gets Classic.

### Steps 6 to 8, the fast way: `npm run ld:setup`

Steps 6 to 8 can be done by hand (below) or with one command. The script creates the hero flag and the `beta-shoppers` segment if they are missing, then sets the targeting exactly as in Step 8 and turns the flag On. It is safe to run again.

1. Create an API access token: LaunchDarkly > **Organization settings** > **Authorization** > **Create token**, role **Writer**. It is shown once.
2. Add it to `.env` (see Step 9) as `LD_API_TOKEN=...`. Like the trigger URL, it is never prefixed with `VITE_` and never committed.
3. If your project or environment keys are not `default` and `production`, set `LD_PROJECT_KEY` and `LD_ENVIRONMENT_KEY` too.
4. Run `npm run ld:setup` (or `npm run ld:setup -- --dry-run` to see the changes first).

The script also checks that the environment it changes is the one your `VITE_LD_CLIENT_SIDE_ID` belongs to. The configuration lives in `scripts/ld-targeting.mjs`, and a unit test keeps it in step with the Release Console's labels.

Why this exists: in a brand-new environment, the dashboard's attribute dropdown lists only attributes LaunchDarkly has already received from an SDK, so `betaTester`, `loyaltyTier`, and `state` cannot be picked until shoppers with those attributes have visited. The REST API has no such limit.

### Step 6: Recreate the Part 2 hero flag

Create a second flag with **exactly** these settings:

| Setting | Value |
|---|---|
| Name | Release landing hero |
| Key | `release-landing-hero` |
| Type | Boolean (`true` = Winter-Ready hero, `false` = current hero) |
| Off variation | `false` |
| **Available on client-side SDKs** | **On** |
| Permanent flag | Off |

### Step 7: Create the `beta-shoppers` segment

In LaunchDarkly, open **Segments** and create a **rule-based** segment:

| Setting | Value |
|---|---|
| Name and key | `beta-shoppers` |
| Rule | Context kind `user`, attribute `betaTester` **is one of** `true` (boolean, not the string "true") |

If `betaTester` is not in the attribute dropdown, LaunchDarkly has not yet received a context with it: run the app, switch the Release Console to **Beta tester, Seattle**, and wait for the context to appear on the **Contexts** page, or use `npm run ld:setup`.

Segments let several flags reuse one audience definition, which is how LaunchDarkly recommends managing early-access groups.

### Step 8: Target the hero

Open `release-landing-hero` > **Targeting** in your environment and set it up **in this order** (LaunchDarkly checks top to bottom and stops at the first match):

| Order | Section | Setting | Serve |
|---|---|---|---|
| 1 | Individual targets | Context key `qa-tester-001` | `true` |
| 2 | Rule "Employees" | `email` **ends with** `@switchbacksupply.test` | `true` |
| 3 | Rule "Beta shoppers" | Context **is in segment** `beta-shoppers` | `true` |
| 4 | Rule "Gold members in Central states" | `loyaltyTier` **is one of** `gold` **AND** `state` **is one of** `TN, TX, IL, MN, CO` | `true` |
| 5 | Default rule | everyone else | `false` |

Turn the flag **On** and save. If you add, remove, or reorder rules, update `HERO_TARGETING` in `web/src/launchdarkly/config.ts` so the Release Console labels them correctly.

### Step 9: Configure your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in both values:

```bash
VITE_LD_CLIENT_SIDE_ID=your-client-side-id
LD_TRIGGER_URL_CHECKOUT_OFF=your-generic-trigger-url
```

`.env` is git-ignored. The trigger URL is deliberately **not** prefixed with `VITE_`, because Vite bundles every `VITE_` variable into public browser code.

### Step 10: Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Click the **Release Console** in the bottom-left corner to expand it; it should show **SDK: Streaming**.

---

## Demo walkthrough (about 3 minutes)

Put LaunchDarkly and the storefront side by side. Start with `release-new-checkout` turned **Off**.

| Flag value | Checkout inside the drawer |
|---|---|
| `false` (also the fallback if LaunchDarkly is unreachable) | **Classic checkout**: three steps (Shipping, Payment, Review) with empty, validated fields |
| `true` | **Express checkout**: one page with a saved address and card, and one-tap ordering |

The badge in the drawer's header always shows which checkout is live.

**1. Open checkout.** Open any product, pick a size, and click **Add to pack**. The checkout drawer slides in showing **Classic checkout**. **Leave the drawer open** for the rest of the demo; the point is that the swap happens mid-checkout. (To place a Classic order, use the test card `4242 4242 4242 4242` with any future expiry. Nothing you type leaves the browser.)

**2. Release.** In LaunchDarkly, turn the flag **On**, set the default rule to serve **true**, and click **Review and save**. Within a moment the open drawer swaps to **Express checkout** in place, with no page reload. A toast announces the release and the Release Console's listener log records it.

**3. Roll back from the dashboard.** Turn the flag **Off**. The drawer swaps straight back to **Classic checkout**.

**4. Remediate from the command line.** Turn the flag back **On** (serving **true**) so Express is showing, then simulate an incident from a second terminal:

```bash
npm run remediate -- "Payment errors spiking on Express checkout"
```

The trigger turns the flag off, the drawer reverts to Classic live, and the flag's **History** in LaunchDarkly records the change with your incident label. This is the same call a monitoring tool such as Datadog or New Relic would make automatically when an alert fires.

**5. Test in production (optional, requires setup Step 5).** Set the default rule back to serve **false** and keep the flag **On**, with `qa-tester-001` individually targeted to **true**. In the Release Console, switch **Shopping as** between **Guest shopper** (Classic) and **Internal QA tester** (Express). Same production code, two audiences, no reload.

---

## How it works

### 1. One client, one stream: `web/src/main.tsx`

```tsx
const LDProvider = createLDReactProvider(LD_CLIENT_SIDE_ID, shoppers.guest.context, {
  ldOptions: { streaming: true, useCamelCaseFlagKeys: false },
});
```

`createLDReactProvider` (React Web SDK v4) creates the LaunchDarkly client, starts it, and places it in React context. `streaming: true` keeps a persistent connection open, so LaunchDarkly **pushes** flag changes to the browser instead of the app polling for them. That push is what makes releases and rollbacks instant.

### 2. The flag and the listener: `web/src/components/CheckoutDrawer.tsx`

```tsx
// Release: the live flag value. Re-renders this component when the flag changes.
const showNewCheckout = useBoolVariation('release-new-checkout', false);

// Listener: an explicit subscription to this one flag's change event.
useEffect(() => {
  const handleCheckoutFlagChange = () => {
    const isOn = ldClient.boolVariation('release-new-checkout', false);
    showToast(/* release or rollback */);
    logEvent(/* timestamped entry for the Release Console */);
  };
  ldClient.on('change:release-new-checkout', handleCheckoutFlagChange);
  return () => ldClient.off('change:release-new-checkout', handleCheckoutFlagChange);
}, [ldClient, showToast, logEvent]);

return showNewCheckout ? <NewCheckout /> : <ClassicCheckout />;
```

- `useBoolVariation` alone already meets "switch instantly with no page reload": when LaunchDarkly pushes a change, only the components using that flag re-render.
- The explicit `change:release-new-checkout` listener makes the mechanism visible. The event carries the context, not the value, so the handler reads the new value back with `boolVariation`.
- The cleanup function unsubscribes with the same function reference, so listeners never pile up.
- The fallback `false` means shoppers get the known-good Classic checkout if LaunchDarkly is ever unreachable.

### 3. Contexts and test in production: `web/src/launchdarkly/contexts.ts`

Guests get an anonymous context with a random, device-stable key (no personal data, and a consistent experience across visits). The QA tester has a fixed key, `qa-tester-001`, which is what individual targeting matches. The Release Console switches between them with `ldClient.identify()`, which swaps the context and refetches flag values without a reload.

### 4. Remediation: `scripts/remediate.sh`

A `POST` to the Generic trigger URL with an optional JSON body (`eventName`, `url`) that labels the change in flag history. The script reads only `LD_TRIGGER_URL_CHECKOUT_OFF` from `.env` and never prints it.

### Where to change things

| To change | Edit |
|---|---|
| Flag key or fallback value | `web/src/launchdarkly/config.ts` |
| Client-side ID | `.env` (`VITE_LD_CLIENT_SIDE_ID`) |
| QA tester key | `web/src/launchdarkly/contexts.ts` |
| Personas and context attributes | `web/src/launchdarkly/contexts.ts` |
| Hero targeting labels and Central states | `web/src/launchdarkly/config.ts` (`HERO_TARGETING`, `CENTRAL_STATES`) |
| Products, prices, colors, sizes | `scripts/catalog-source.py`, then run `npm run catalog` |
| Product photos | Add `web/public/products/<product-id>.webp`, then run `npm run catalog` |
| Trigger URL | `.env` (`LD_TRIGGER_URL_CHECKOUT_OFF`) |

---

## Beyond the manual trigger

A manual trigger is the first step on a remediation ladder that enterprise teams climb:

1. **Flag trigger** (this part): a person, or a monitoring tool, calls a URL to turn the feature off.
2. **Kill switch flag**: a permanent flag that guards a risky dependency long after launch.
3. **Guarded rollout**: LaunchDarkly ramps the release gradually, watches error rate and business metrics, and **rolls back on its own** when a regression appears. No human in the loop. *(Extra credit 1 in this repo.)*

---

## Part 2: Target

### The business problem

The landing page is being revamped by several teams, and Switchback Supply's team owns one component: the **home page hero**. About 40,000 people visit every day, so a bad change is expensive and the project is under a lot of scrutiny. The team wants to put the new hero in front of the right people first (QA, employees, opted-in beta shoppers, and a high-value regional audience) while everyone else keeps today's page, and to change that audience without a deploy.

### What you will see

The hero is wrapped in the boolean flag `release-landing-hero`:

| Flag value | Hero |
|---|---|
| `false` (default rule, and the fallback if LaunchDarkly is unreachable) | The current **"Gear for the long way up"** hero |
| `true` | The revamped **Winter-Ready** hero: a seasonal message, three featured products, and a free-shipping callout |

Every visitor is a LaunchDarkly `user` context built from their shopper profile:

| Attribute | Example | Notes |
|---|---|---|
| `key` | `shopper-gold-001`, or a random `guest-...` key | Individual targeting matches on this; never contains personal data |
| `anonymous` | `true` for guests | Anonymous contexts stay off the Contexts page |
| `name` | `Gold Member (Nashville)` | Makes contexts easy to find on the Contexts page |
| `email` | `merch@switchbacksupply.test` | **Private**: usable in targeting rules, stripped from analytics events |
| `loyaltyTier` | `none`, `silver`, `gold` | |
| `state`, `country` | `TN`, `US` | `state` is omitted when unknown, so state rules simply do not match |
| `deviceType` | `desktop` or `mobile` | Detected in the browser, so it works for guests too |
| `betaTester` | `true` | Drives the `beta-shoppers` segment |

In a real store these values come from the signed-in shopper's account. This demo has no login, so the Release Console offers five **personas** as stand-ins, and lets you edit any shopper's attributes:

| Persona | What it demonstrates | Hero |
|---|---|---|
| Guest shopper | Matches nothing, so the default rule applies | Current |
| Internal QA tester | **Individual targeting** (`qa-tester-001`) | Winter-Ready |
| Employee | **Rule 1** through the private `email` attribute | Winter-Ready |
| Beta tester, Seattle | **Rule 2** through the `beta-shoppers` segment | Winter-Ready |
| Gold member, Nashville | **Rule 3**, a two-clause rule (tier AND state) | Winter-Ready |

The console's **How LaunchDarkly chose the hero** panel shows LaunchDarkly's own evaluation reason for the current shopper, row by row: the matching row, the rows above it that did not match, and the rows below it that were never evaluated.

### Demo walkthrough (about 3 minutes)

Open the home page and expand the **Release Console**.

1. **Default rule.** As **Guest shopper**, you see the current hero. The panel reads "No targeting matched; default rule served".
2. **Individual targeting.** Choose **Internal QA tester**. The hero swaps to Winter-Ready with no reload, and the panel reads "Individually targeted".
3. **Rule-based targeting.** Choose **Employee**, then **Beta tester**, then **Gold member**. Each gets the Winter-Ready hero through a different rule: a private attribute, a segment, and a two-clause rule.
4. **Attributes drive the result.** As the Gold member, change **State** from TN to CA. They leave the Central region, fall through to the default rule, and get the current hero. Switch **Beta tester** on and they match rule 2 instead.
5. **First match wins.** Turn on **Employee email** as well. Rule 1 now matches, and rule 2 shows "Not evaluated", which is LaunchDarkly's top-to-bottom evaluation made visible.
6. **Change targeting in LaunchDarkly.** With the Beta tester selected, remove or reorder the Beta shoppers rule in the dashboard and save. The store follows within moments, with no deploy.

The console changes **who the shopper is**; it never changes the rules. Rules live only in LaunchDarkly, because editing them from the browser would require putting a LaunchDarkly write token in public code.

### How it works

- **Contexts** (`web/src/launchdarkly/contexts.ts`): `toLDContext()` turns a shopper's attributes into a `user` context and always marks `email` private with `_meta.privateAttributes`.
- **Switching shoppers** (`web/src/state/Shopper.tsx`): every persona choice or attribute edit calls `ldClient.identify()`. The SDK fetches values for the new context and the hooks re-render, with no page reload. The checkout listener checks whether a change came from a shopper switch, so the demo never calls a targeting change a "release".
- **The flagged component** (`web/src/components/LandingHero.tsx`): `useBoolVariation('release-landing-hero', false)` chooses the hero. On the first page load it shows a neutral placeholder for up to 1.2 seconds while LaunchDarkly answers, so a targeted shopper never sees the old hero flash and swap. If LaunchDarkly does not answer in time, it shows the current hero.
- **Why each shopper got their hero** (`web/src/launchdarkly/explain.ts`): the SDK is started with `withReasons: true`, and `useBoolVariationDetail()` returns LaunchDarkly's reason (`TARGET_MATCH`, `RULE_MATCH` with a rule index, `FALLTHROUGH`, or `OFF`). The console turns that reason into the row-by-row view; it does not re-implement targeting.
- **Privacy in transit**: the SDK is started with `useReport: true`, so the shopper's context (including the private email) travels in request bodies instead of URLs, where it could land in proxy or server logs. In browsers the SDK then keeps a context-free streaming connection open and fetches fresh values whenever LaunchDarkly signals a change. The end-to-end tests check both that no request URL contains a context and that the email never appears in analytics events.

### Production notes

- **Bootstrapping**: for a 40,000-visitor page, the next step is to render the first page with flag values already in it (server-side evaluation passed to `createLDReactProvider` as `bootstrap`), which removes the placeholder entirely.
- **Rolling out to everyone**: once the targeted groups are happy, replace the default rule's `false` with a percentage rollout, or a guarded rollout that watches error rate and conversions and rolls back on its own (extra credit 1).

## Testing

Two layers of automated tests run on every pull request.

| Layer | Tool | What it proves |
|---|---|---|
| Unit and component (69 tests) | Vitest + React Testing Library | Checkout validation, catalog lookups, the shipping rule, cart stock limits and persistence, contexts and private attributes, the evaluation-reason explainer, the hero's placeholder and fallback, and the flagged checkout drawer: Classic for `false`, Express for `true`, the fallback when LaunchDarkly has no value, a live swap with toast and log, shopper switches labeled as switches, and listener cleanup |
| End to end (61 test runs) | Playwright in Chromium | The whole store in a real browser: every header, tile, chip, card, breadcrumb, and related-product link; all 25 product pages; size, color, and stock rules; the cart and drawer; both checkouts; the 404 page; phone layout. Plus both flags: **release and roll back mid-checkout with no page reload**; every Part 2 persona, rule, and attribute edit with the reason shown; a targeting change reaching the shopper live; contexts never in URLs and the private email never in events; and fallbacks when LaunchDarkly is unreachable |

### How the flag is tested without a LaunchDarkly account

The end-to-end tests run the real LaunchDarkly React SDK against a small local mock of LaunchDarkly's client-side endpoints (`tests/mock-launchdarkly/server.mjs`). It speaks the same streaming protocol and evaluates the Part 2 targeting (individual targets, rules, a segment, and the default rule, in LaunchDarkly's order), so a test can open the checkout drawer, "save" a new flag value, and watch the drawer swap, or switch personas and check which rule LaunchDarkly reported. The app is pointed at the mock with three optional settings, `VITE_LD_BASE_URI`, `VITE_LD_STREAM_URI`, and `VITE_LD_EVENTS_URI`. Those are the same settings a customer uses to route the SDK through a [LaunchDarkly Relay Proxy](https://launchdarkly.com/docs/sdk/relay-proxy); leave them blank to connect to LaunchDarkly directly.

Every test runs against the Vite dev server, where React's StrictMode surfaces effect and cleanup bugs. The release-critical tests (tagged `@smoke`) also run against an optimized production build.

### Running the tests

```bash
npm test                          # unit and component tests (about 10 seconds)
npx playwright install chromium   # first time only: downloads the test browser
npm run test:e2e                  # end-to-end tests (about 3 minutes); starts its own servers
npm run test:e2e:ui               # the same, in Playwright's interactive UI
```

The end-to-end tests never contact real LaunchDarkly and do not use your `.env` keys. They need ports 5180, 5181, and 8787 free.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Page shows "Almost at the trailhead" | `VITE_LD_CLIENT_SIDE_ID` is empty. Fill in `.env` and restart `npm run dev`. |
| Console shows "Timed out" or "Failed" | Wrong client-side ID, no network, or a browser extension blocking LaunchDarkly. The app keeps working on fallback values. |
| Flag changes do nothing | "Available on client-side SDKs" is off for the flag, or the flag lives in a different environment than your client-side ID. |
| QA tester does not get Express checkout | The flag must be **On** for individual targets to apply, and the key must be exactly `qa-tester-001`. |
| The hero never changes for any persona | Check that `release-landing-hero` exists, is **On**, is available to client-side SDKs, and has the targeting from Step 8. |
| The console names the wrong rule | The rule order in LaunchDarkly differs from `HERO_TARGETING` in `web/src/launchdarkly/config.ts`; make them match. |
| An attribute is missing from a dashboard dropdown | LaunchDarkly lists only attributes it has received. Switch personas in the Release Console and wait for **Contexts** to update, or use `npm run ld:setup`. |
| Contexts and Live events stay empty, but flags work | Analytics events are being blocked. In DevTools > Network, requests to `events.launchdarkly.com` show `(blocked:other)` when a browser extension or Brave Shields blocks them. Allow the domain or use a clean browser profile. Flags keep working, because evaluation does not depend on events. |
| `npm run ld:setup` fails with HTTP 401 or 403 | The API token is missing, invalid, or lacks the Writer role. |
| `npm run remediate` fails with HTTP 404 | The trigger was reset or deleted. Create or reset it and update `.env`. |

---

## Project structure

```
switchback-supply/
  data/catalog.json             25 products, 109 SKUs (generated; shared with the server later)
  web/                          React 19 + Vite + TypeScript storefront
    src/main.tsx                LaunchDarkly provider setup
    src/launchdarkly/           Flag keys, fallbacks, contexts, personas, reason explainer
    src/pages/                  Home, shop, product page, not found
    src/components/             Layout, product cards, checkout variants, Release Console
    src/state/                  Cart (persisted by SKU), toasts, and the listener log
    public/products/            Product photos (WebP, 800 x 800)
  scripts/remediate.sh          Calls the flag trigger (Part 1 remediation)
  scripts/ld-setup.mjs          Applies the Part 2 flag, segment, and targeting through the REST API
  scripts/ld-targeting.mjs      The Part 2 configuration as data (reviewed in pull requests)
  scripts/catalog-source.py     Product copy, prices, and variants; generates data/catalog.json
  scripts/validate-catalog.mjs  Catalog checks run in CI
  vercel.json                   Build settings and single-page app routing for Vercel
  tests/e2e/                  Playwright end-to-end tests
  tests/mock-launchdarkly/    Local mock of LaunchDarkly's client-side endpoints for tests
  playwright.config.ts        End-to-end setup: mock server, dev server, production build
  .github/workflows/ci.yml    Catalog check, typecheck, lint, unit tests, build, secrets guard, end-to-end tests
  .env.example                Configuration template
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the storefront on http://localhost:5173 |
| `npm run build` | Typecheck and build for production |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | Lint with oxlint |
| `npm run remediate -- "label"` | Turn the checkout flag off through its trigger |
| `npm run ld:setup` | Create and target the Part 2 hero flag and segment in LaunchDarkly (`-- --dry-run` to preview) |
| `npm test` | Unit and component tests |
| `npm run test:e2e` | End-to-end tests in Chromium (run `npx playwright install chromium` once first) |
| `npm run catalog` | Regenerate `data/catalog.json` from `scripts/catalog-source.py` (needs Python 3) |
| `npm run validate:catalog` | Check the catalog for duplicate SKUs, bad prices, and missing images |

## LaunchDarkly documentation used

- [React Web SDK reference (v4)](https://launchdarkly.com/docs/sdk/client-side/react/react-web) and the [React SDK 4.0 changelog](https://launchdarkly.com/changelog/react-sdk-4-0-0/)
- [Subscribing to flag changes](https://launchdarkly.com/docs/sdk/features/flag-changes)
- [Flag triggers](https://launchdarkly.com/docs/home/releases/triggers) and [Creating flag triggers](https://launchdarkly.com/docs/home/releases/triggers-create)
- [Individual targeting](https://launchdarkly.com/docs/home/flags/individual-targeting)
- [Anonymous contexts](https://launchdarkly.com/docs/sdk/features/anonymous) and [Identifying contexts](https://launchdarkly.com/docs/sdk/features/identify)
- [Contexts](https://launchdarkly.com/docs/home/flags/contexts), [Context configuration](https://launchdarkly.com/docs/sdk/features/context-config), and [Private attributes](https://launchdarkly.com/docs/sdk/features/private-attributes)
- [Targeting rules](https://launchdarkly.com/docs/home/flags/target-rules), [Flag evaluation rules](https://launchdarkly.com/docs/sdk/concepts/flag-evaluation-rules), and [Segments](https://launchdarkly.com/docs/home/flags/segment-types)
- [Evaluation reasons](https://launchdarkly.com/docs/sdk/concepts/evaluation-reasons) and [Bootstrapping](https://launchdarkly.com/docs/sdk/features/bootstrapping)
- [REST API: update feature flag with semantic patch](https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag), [update segment](https://launchdarkly.com/docs/api/segments/patch-segment), and [API access tokens](https://launchdarkly.com/docs/home/account/api)
- [Kill switch flags](https://launchdarkly.com/docs/home/flags/killswitch) and [Guarded rollouts](https://launchdarkly.com/docs/home/releases/guarded-rollouts)

## About the catalog

Switchback Supply and every product are fictional. Product photos were generated with Leonardo.ai from prompts that exclude logos and text, then converted to 800 x 800 WebP (about 30 KB each). Prices, specs, and stock levels are invented. A few SKUs are deliberately sold out or low in stock, so product pages show real availability states. Both checkouts use the same shipping rule (free over $150, otherwise $8), so the feature flag changes the experience, never the price.

## How this was built

Built by David Rhodes with Claude Code as a pair programmer. Claude researched the current LaunchDarkly documentation and drafted each pull request; David reviewed, ran, and tested every change against a live LaunchDarkly environment before merging.

## License

MIT. Switchback Supply is fictional. Product names and illustrations are invented for this demo.
