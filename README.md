# Switchback Supply

**A LaunchDarkly sample app for a fictional outdoor gear retailer.** It shows how a team ships features faster without adding risk: release a new checkout to production behind a feature flag, test it there with internal users first, and roll it back in under a second when something goes wrong, with no deploy and no page reload.

Switchback Supply plays the role of "ABC Company" from the exercise brief. Each section is written for the persona the brief names, the way it would be handed to a prospective customer.

**Live demo: [web-puce-kappa-92.vercel.app](https://web-puce-kappa-92.vercel.app/)** (a 12-minute presenter's script is in [docs/demo-runbook.md](docs/demo-runbook.md)), connected to the LaunchDarkly trial environment this repo was built against. Open the **Release Console** in the bottom-left corner to see the SDK connection, live flag values, and why LaunchDarkly chose each one. To run your own copy against your own LaunchDarkly account, follow [Setup, step by step](#setup-step-by-step), then [Deploy to Vercel](#deploy-to-vercel-optional) if you want a public URL.

| Section | Persona | What it shows | Status |
|---|---|---|---|
| Storefront | All | 25-product catalog with color and size variants, product pages, a persistent cart | Done |
| **Part 1: Release and Remediate** | Engineering manager | Flag-wrapped checkout, live listener, test in production, flag trigger remediation, checkout metrics | Done |
| **Part 2: Target** | Developer | Winter-Ready hero behind a flag, shopper contexts with attributes, individual and rule-based targeting | Done |
| [**Extra credit: AI Configs**](#extra-credit-ai-configs) | AI product manager | AgentControl (formerly AI Configs) shopping assistant on Anthropic Claude: prompt and model changed live, a kill switch, Monitoring, and an experiment asking whether a better prompt can match a larger model ([results](#results-the-larger-model-wins-on-kits-but-fails-the-speed-guardrail)) | Done |

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

In LaunchDarkly, click the **gear icon** (bottom left) > **Settings** > **All environments**, with your project selected at the top, then open your environment (**Test**) and its **SDK keys** tab. Under **Client-side IDs**, copy the ID.

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

Steps 6 to 8 can be done by hand (below) or with one command. The script creates the hero flag and the `beta-shoppers` segment if they are missing, then sets the targeting exactly as in Step 8 and turns the flag On. It also creates Part 1's two checkout metrics (see [Measuring the release](#3-measuring-the-release-the-checkout-completed-event)). It is safe to run again.

1. Create an API access token: in LaunchDarkly, click the **gear icon** (bottom left) > **Settings** > **Authorization** (under Security) > **Create token**, role **Writer**. It is shown once.
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

### Deploy to Vercel (optional)

The store is a static single-page app, so any static host works. The repo includes a `vercel.json` for [Vercel](https://vercel.com/docs/project-configuration) that sets the install command (`npm ci`), the build command (`npm run build`), the output folder (`web/dist`), and a rewrite so deep links like `/products/ridgeline-45` load the app.

1. In Vercel, **Add New > Project** and import your fork of this repository.
2. Leave **Root Directory** as the repository root. Vercel reads `vercel.json` only from that folder; if Root Directory is `web`, the build looks for a `dist` folder that does not exist there and fails with `No Output Directory named "dist" found`. Any framework preset works, because `vercel.json` overrides its build settings, but keep the **Override** toggles off.
3. Under **Environment Variables**, add `VITE_LD_CLIENT_SIDE_ID` with the same client-side ID as your `.env`. Do not add the trigger URL or the API token: they are only used by scripts on your machine.
4. Deploy. The Release Console on the live URL should show **SDK: Streaming**, and flag changes in LaunchDarkly should reach the live site with no redeploy.

`VITE_` variables are read at build time, so redeploy after changing the client-side ID.

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

### 3. Measuring the release: the `checkout-completed` event

A flag that can only say "on" or "off" cannot tell you whether the new checkout is better. When a shopper places an order, the drawer sends a [custom event](https://launchdarkly.com/docs/sdk/features/events) with the order total as its value:

```tsx
ldClient.track('checkout-completed', { checkout: 'express', items: 2 }, orderTotal);
```

`npm run ld:setup` builds two [metrics](https://launchdarkly.com/docs/home/metrics) on that one event ([`scripts/ld-metrics.mjs`](scripts/ld-metrics.mjs)):

| Metric | Kind | Measures |
|---|---|---|
| `checkout-completed` | Conversion | Did the shopper place an order? |
| `checkout-order-value` | [Value](https://launchdarkly.com/docs/home/metrics/custom-numeric), dollars | Order dollars per shopper. Shoppers who did not order count as $0, so it reflects both conversion and order size |

LaunchDarkly credits each event to the checkout that shopper was served, so these metrics can compare Express with Classic in an experiment, or be watched by a guarded rollout. The event carries no personal data. To see events arrive, open **Metrics** in LaunchDarkly and check the metric's event activity, or watch **Live events**. (Ad blockers stop these events; see [Troubleshooting](#troubleshooting).)

### 4. Contexts and test in production: `web/src/launchdarkly/contexts.ts`

Guests get an anonymous context with a random, device-stable key (no personal data, and a consistent experience across visits). The QA tester has a fixed key, `qa-tester-001`, which is what individual targeting matches. The Release Console switches between them with `ldClient.identify()`, which swaps the context and refetches flag values without a reload.

### 5. Remediation: `scripts/remediate.sh`

A `POST` to the Generic trigger URL with an optional JSON body (`eventName`, `url`) that labels the change in flag history. The script reads only `LD_TRIGGER_URL_CHECKOUT_OFF` from `.env` and never prints it.

### Where to change things

| To change | Edit |
|---|---|
| Flag key or fallback value | `web/src/launchdarkly/config.ts` |
| Checkout metric event or metric definitions | `METRIC_EVENTS` in `web/src/launchdarkly/config.ts` and `scripts/ld-metrics.mjs` (a unit test keeps them in step) |
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
3. **Guarded rollout**: LaunchDarkly ramps the release gradually, watches error rate and business metrics, and **rolls back on its own** when a regression appears. No human in the loop. This repo stops at the trigger, but the flag is ready for a guarded rollout: the checkout already reports conversion and order value. A production rollout would add an error-rate metric, for example from LaunchDarkly's observability SDK, so a regression rolls back on its own.

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
3. **Rule-based targeting.** In the **SHOPPING AS** dropdown (not the switches below it), choose **Employee**, then **Beta tester, Seattle**, then **Gold member, Nashville**. Each gets the Winter-Ready hero through a different rule: a private attribute, a segment, and a two-clause rule.
4. **Attributes drive the result.** As **Gold member, Nashville**, with the **Employee email** and **Beta tester** switches both off, change only **State** from TN to CA. Rule 3 needs gold **and** a Central state, so it no longer matches, and nothing else does either: LaunchDarkly serves the flag's **default rule** (the value for everyone no rule catches), the current hero. Turn the **Beta tester** switch on and they match rule 2 instead.
5. **First match wins.** Turn on **Employee email** as well. Rule 1 now matches, and rule 2 shows "Not evaluated", which is LaunchDarkly's top-to-bottom evaluation made visible.
6. **Change targeting in LaunchDarkly.** With **Beta tester, Seattle** chosen under **SHOPPING AS**, remove or reorder the Beta shoppers rule in the dashboard and save. The store follows within moments, with no deploy.

The console changes **who the shopper is**; it never changes the rules. Rules live only in LaunchDarkly, because editing them from the browser would require putting a LaunchDarkly write token in public code.

### How it works

- **Contexts** (`web/src/launchdarkly/contexts.ts`): `toLDContext()` turns a shopper's attributes into a `user` context and always marks `email` private with `_meta.privateAttributes`.
- **Switching shoppers** (`web/src/state/Shopper.tsx`): every persona choice or attribute edit calls `ldClient.identify()`. The SDK fetches values for the new context and the hooks re-render, with no page reload. The checkout listener checks whether a change came from a shopper switch, so the demo never calls a targeting change a "release".
- **The flagged component** (`web/src/components/LandingHero.tsx`): `useBoolVariation('release-landing-hero', false)` chooses the hero. On the first page load it shows a neutral placeholder for up to 1.2 seconds while LaunchDarkly answers, so a targeted shopper never sees the old hero flash and swap. If LaunchDarkly does not answer in time, it shows the current hero.
- **Why each shopper got their hero** (`web/src/launchdarkly/explain.ts`): the SDK is started with `withReasons: true`, and `useBoolVariationDetail()` returns LaunchDarkly's reason (`TARGET_MATCH`, `RULE_MATCH` with a rule index, `FALLTHROUGH`, or `OFF`). The console turns that reason into the row-by-row view; it does not re-implement targeting.
- **Privacy in transit**: the SDK is started with `useReport: true`, so the shopper's context (including the private email) travels in request bodies instead of URLs, where it could land in proxy or server logs. In browsers the SDK then keeps a context-free streaming connection open and fetches fresh values whenever LaunchDarkly signals a change. The end-to-end tests check both that no request URL contains a context and that the email never appears in analytics events.

### Production notes

- **Bootstrapping**: for a 40,000-visitor page, the next step is to render the first page with flag values already in it (server-side evaluation passed to `createLDReactProvider` as `bootstrap`), which removes the placeholder entirely.
- **Rolling out to everyone**: once the targeted groups are happy, replace the default rule's `false` with a percentage rollout, or a guarded rollout that watches error rate and conversions and rolls back on its own.

## Extra credit: AI Configs

LaunchDarkly now calls this product **AgentControl** (formerly AI Configs). The dashboard shows it under **Agent management > Configs**. The REST API, the SDK package, and this repo's code still use the older `ai-config` names.

### The business problem

Switchback Supply is rolling out a chatbot, the **Trail guide**, that helps shoppers choose gear. The AI product manager keeps finding ways to improve its prompt, and a newer, larger model is available. They need three things:

1. **Change the prompt or the model without a deploy.** Prompt wording is product copy. It should not wait for an engineering release.
2. **Turn the AI off instantly** if it misbehaves, while the store keeps working.
3. **Find out which change actually helps shoppers,** with numbers rather than opinions, and know what each version costs.

### What you will see

A **Trail guide** button in the header opens a chat panel on every page. Ask about a trip ("Two nights in Colorado in October. What should I pack?"). The guide answers using the store's real catalog. Each product it recommends appears as a card that links to its product page. Under every answer, a small label names the model and the variation that answered, so a change in LaunchDarkly is visible in the chat. Thumbs up and down buttons send feedback to LaunchDarkly.

The config `shopping-assistant` has four variations. Each one changes a single thing from Control, so an experiment can tell which change made the difference:

| Variation | Model | Prompt | What it tests |
|---|---|---|---|
| **Control** | Claude Haiku 5.5 | Guide: up to three products, one line each | The baseline |
| **Treatment A** (`best-pick`) | Claude Haiku 5.5 | Best pick: one product, why it fits, one alternative, a follow-up question when details are missing | A prompt change only |
| **Treatment B** (`sonnet`) | Claude Sonnet 5.5 | Guide (same as Control) | A model change only |
| **Treatment C** (`bundle`) | Claude Haiku 5.5 | Kit: up to three products that work together for the whole trip, only what the trip needs, within any budget, and a free-shipping note at $150 | A prompt change only |

The prompts live in [`scripts/ld-ai-config.mjs`](scripts/ld-ai-config.mjs). Every prompt tells the model to recommend only catalog products, using the catalog the server passes in as the `{{catalog}}` variable.

### Setup

These steps add to the Part 1 and Part 2 setup above. They use the same LaunchDarkly environment.

**Step A1: Add the two server keys to `.env`.** The assistant runs on the server, because the model key must never reach a browser:

```bash
LD_SDK_KEY=sdk-...          # LaunchDarkly > gear icon > Settings > All environments > Test > SDK keys tab > SDK key
ANTHROPIC_API_KEY=sk-ant-... # console.anthropic.com > API keys
```

Use the server-side **SDK key** from the same environment as your client-side ID. It is a different credential from the client-side ID and from `LD_API_TOKEN`. Neither key has a `VITE_` prefix, so Vite never bundles them into the browser. Set a monthly spend limit in the Anthropic Console; the experiment below costs a few dollars.

**Step A2: Create the config, its variations, and the experiment metric.** Run the setup script. It is the same script Part 2 uses, and it is safe to run again:

```bash
npm run ld:setup -- --dry-run   # preview
npm run ld:setup
```

It adds four things:

1. Claude model configs, but only if your project does not already have them.
2. The `shopping-assistant` Completion config, with the three variations above.
3. A default rule that serves **Control**. LaunchDarkly already points a new config's default rule at the first variation created, which is Control here. The script sets it explicitly so the result never depends on creation order.
4. The `assistant-recommended-product` metric.

To do the same by hand:

1. Go to **Agent management > Configs > Create > Completion**. Use the key `shopping-assistant`.
2. For each variation, choose the model, set `max_tokens` to `1024` and `effort` to `low`, and paste the system prompt from `scripts/ld-ai-config.mjs`.
3. On the **Targeting** tab, set the default rule to Control, turn targeting **On**, and save.
4. Go to **Metrics > Create metric**. Choose **Custom**, then **Conversion (binary)**, with the event key `assistant-recommended-product`.

**Step A3: Run it.** Restart `npm run dev`, because Vite reads `.env` only at startup. Open the **Trail guide** and ask a question. The label under the answer should read **Claude Haiku 5.5 · variation control**.

**Step A4 (live site): add the keys to Vercel.** Go to Vercel > Settings > Environment Variables and add `LD_SDK_KEY` and `ANTHROPIC_API_KEY`. Mark both **Sensitive**, then redeploy. The chat calls two Vercel Functions in [`api/`](api/), which run the same code as the dev server.

### Demo walkthrough (about 3 minutes)

1. **Ask a question.** Open the Trail guide and ask "Which headlamp is best for under $60?". The label shows Control on Claude Haiku 5.5.
2. **Change the model with no deploy.** In LaunchDarkly, open `shopping-assistant` > **Targeting**, set the default rule to **Treatment B**, and save (only when no experiment is running on the config; during an experiment, the experiment controls the default rule, so show its Results tab instead). Ask again. The label now reads Claude Sonnet 5.5. No code changed, nothing was redeployed, and the page was not reloaded.
3. **Change the prompt live.** Open the **Variations** tab, edit Control's prompt (for example, "Answer in exactly two sentences"), and save. The next answer follows the new prompt.
4. **Turn the AI off.** Turn the config's targeting **Off**. The next question gets a polite fallback and a link to the shop, and no model is called. Turn it back on and the guide returns. This is Part 1's kill switch, applied to AI.
5. **Show the data.** Open the **Monitoring** tab. It shows tokens, time to generate, generations, errors, cost, and satisfaction from the thumbs buttons, each broken out by variation. Data updates about once a minute.

### The experiment: can a better prompt match a bigger model?

The brief's optional step: compare prompt and model variants on a metric that matters. A larger model costs about 20 times as much per token as Haiku and answers more slowly. The question an AI product manager asks is whether a prompt change can get the bigger model's results at the smaller model's speed and price. The [experiment](https://launchdarkly.com/docs/home/experimentation) compares **Control**, **Treatment B** (Sonnet), and **Treatment C** (the kit prompt). Treatment A stays in the config but is not part of it.

Every metric is measured on the server from the real reply, with the same context LaunchDarkly evaluated, so each event is credited to the variation that answered. The server first checks every product link against the catalog and drops invented products.

| Metric | Kind | Measures |
|---|---|---|
| `assistant-free-shipping-basket` (**primary**) | Conversion | The real products in the reply total $150 or more, the store's free-shipping threshold. Retailers set that threshold to raise order value, so a guide that suggests a complete kit helps both the shopper and the store |
| `assistant-basket-value` | Value, dollars | The total price of the recommended products. A reply that recommends nothing counts as $0 |
| `assistant-response-time` ([guardrail](https://launchdarkly.com/docs/home/metrics/guardrail-metrics)) | Value, milliseconds, lower is better | How long the shopper waited. A shopper without an answer is left out instead of counting as an instant reply |
| `assistant-recommended-product` | Conversion | The reply linked at least one real product |

Monitoring adds tokens and cost per variation, and real visitors' thumbs add satisfaction.

**A recommended kit is not a sale.** These metrics measure what the guide suggests, and the kit prompt is told to pick only what the trip needs and to respect any budget. A production test would add an add-to-cart event from the chat's product cards and a quality signal, such as thumbs or an [online evaluation](https://launchdarkly.com/docs/home/agentcontrol/online-evaluations), so the experiment can never reward upselling over help.

**Create the experiment** (once Step A2 is done):

1. Open **Agent management > Configs > Shopping assistant**. In the right-hand panel, under **Experiments**, click **Add experiment**. (Or go to **Experimentation > Experiments > Create experiment**.) If an experiment is already running on this config, open it and use **Edit design** instead: LaunchDarkly starts a new iteration with the changes.
2. **Name and hypothesis:** for example "Trail guide: kit prompt vs larger model" and "A kit prompt on Haiku suggests free-shipping kits more often than Control, with no slower answers."
3. **Variations and audience targeting:**
   - Assignment method: **LaunchDarkly flag or config**.
   - Flag or config: `shopping-assistant`.
   - Randomize by: **user**.
4. **Audience allocation:**
   - Percent of user contexts in this experiment: **100%**.
   - Variation served to contexts outside the experiment: **Control**.
5. **Variations split:**
   - **Control**, **Treatment B**, and **Treatment C** at about 33% each. Leave Treatment A out.
   - Control: **Control: Haiku 5.5, guide prompt**.
6. **Metrics:**
   - Metric source: **LaunchDarkly hosted**.
   - Primary: **Assistant kit ships free**.
   - Also add **Assistant kit value**, **Assistant response time**, and **Assistant recommended a product**.
7. **Statistical approach:** choose **[Bayesian](https://launchdarkly.com/docs/home/experimentation/bayesian)**, with the 95% threshold. The form starts on Frequentist with sequential testing. Bayesian reports each variation's probability of being best, which is easier to act on with a few hundred conversations per variation.
8. When the banner says **Ready to start** and the health check says **Healthy**, click **Save**, then **Start**.

LaunchDarkly cannot run an experiment and a guarded rollout on the same config at the same time. To stop an iteration, LaunchDarkly asks you to declare a winner; when nothing should ship, declare Control and say why.

**Synthetic shoppers.** A demo store has no real traffic, and an experiment needs hundreds of conversations per variation. [`scripts/assistant-traffic.mjs`](scripts/assistant-traffic.mjs) plays those shoppers:

- Each one asks a realistic gear question through the store's own `/api/assistant`.
- Every answer is a **real Claude reply** from the variation LaunchDarkly assigned.
- The metrics are measured from that reply, exactly as they are for a person.
- Only the shoppers are simulated. They are labeled with the key `synthetic-shopper-NNNN` and the context attribute `trafficSource: "synthetic"`.

```bash
npm run assistant:traffic -- --dry-run                                   # plan and cost estimate
npm run assistant:traffic -- --base-url http://localhost:5173 --count 10   # smoke test
npm run assistant:traffic -- --base-url https://your-site.vercel.app --count 900 --start 1
```

About 900 conversations (roughly 300 per variation) cost about $3 at current Claude prices; the script prints its estimate first, and at the end a summary per variation: answers, how many recommended a product, how many kits ship free, the average kit, and the average wait. Use a new `--start` range for each run, because LaunchDarkly keeps each shopper key in the same variation. Experiment results refresh periodically, so start the traffic a day before you need a decision.

### Results: the larger model wins on kits but fails the speed guardrail

> Synthetic shoppers, real replies. Every answer below is a real Claude response to a scripted shopper question on the live site, from the variation LaunchDarkly assigned. Only the shoppers are simulated.

The run: 900 shoppers on October 30, 2026, in the Test environment, Bayesian at a 95% threshold. LaunchDarkly found **no sample ratio mismatch**, so the three-way split was even and the comparison is sound.

**Scorecard against the hypothesis** ("A kit prompt on Haiku suggests free-shipping kits more often than Control, with no slower answers"):

| Test | Metric | Treatment B: Sonnet 5.5, guide prompt | Treatment C: Haiku 5.5, kit prompt |
|---|---|---|---|
| Better on the goal | Assistant kit ships free (primary) | **Pass.** LaunchDarkly names it the winning variation | **Fail.** Not better than Control |
| No slower answers | Assistant response time (guardrail) | **Fail.** 2,906 ms against Control's 1,961 ms: +48% (95% interval +41% to +56%) | **Fail.** 2,376 ms: +21% (95% interval +12% to +30%) |

Response times are LaunchDarkly's posterior means for the time spent in the model call, measured on the server. The hypothesis was about the kit prompt, and it is rejected on both counts. Sonnet, the comparison arm, wins the primary metric and fails the guardrail clearly.

The traffic script's own tally of the same 900 replies gives the size of each effect:

| Variation | Shoppers | Kit ships free | Average kit |
|---|---|---|---|
| Control: Haiku 5.5, guide prompt | 311 | 74% | $349 |
| Treatment B: Sonnet 5.5, guide prompt | 297 | 82% | $379 |
| Treatment C: Haiku 5.5, kit prompt | 292 | 70% | $321 |

The shopper counts match LaunchDarkly's exposure counts exactly; the percentages and dollars are the script's measurements, and LaunchDarkly's Results tab has the official figures for each metric.

What it means:

- **The larger model builds bigger kits, and makes shoppers wait for them.** About 8 points more free-shipping kits and a kit about $30 larger, for answers about a second slower (+48%).
- **The kit prompt did not work.** Telling Haiku to suggest only what the trip needs, within budget, made it more restrained, not less, and slower. The hypothesis was wrong, and the experiment showed it without a redeploy.
- **Cost was not one of the metrics.** As a separate estimate: Sonnet's tokens cost about 20 times Haiku's (see `MODELS` in [`scripts/ld-ai-config.mjs`](scripts/ld-ai-config.mjs)), but on a short answer that is under one cent more per answer, so speed, not money, is the trade-off. The config's Monitoring tab shows the measured cost per variation.

**Decision: keep Control as the default, and do not ship Sonnet to everyone.** It failed the guardrail set before the test, and a guardrail only means something if a failure stops a release. What the experiment cannot tell us is whether a slower answer actually costs sales, because it measured suggestions, not purchases. The next step answers that safely:

1. Add a purchase signal: an add-to-cart event from the chat's product cards, sent with `ldClient.track()` like the checkout event in Part 1.
2. Release Sonnet to a small, high-value audience first, for example a rule on `loyaltyTier` is `gold`, the same attribute Part 2 targets, behind a [guarded rollout](https://launchdarkly.com/docs/home/releases/guarded-rollouts) that watches add-to-cart and response time and rolls back on its own if either regresses. (Guarded rollouts depend on your LaunchDarkly plan.)
3. Widen it only if bigger kits turn into more add-to-carts despite the wait.

Every step is a change in LaunchDarkly or one `track()` call; the assistant's code does not change. A quality signal (thumbs, or an [online evaluation](https://launchdarkly.com/docs/home/agentcontrol/online-evaluations)) would complete the picture, so the decision rests on purchases and answer quality, not only on what the guide suggested.

### How it works

| File | Role |
|---|---|
| [`server/assistant.ts`](server/assistant.ts) | Reads the config for each shopper and request, maps its messages to Anthropic's Messages API, calls Claude, tracks the run, sends the experiment events (product recommended, kit value, free-shipping kit, response time), and records feedback |
| [`server/config.ts`](server/config.ts) | Config key, metric event keys, the free-shipping threshold, the safe fallback (disabled), and request limits |
| [`server/runtime.ts`](server/runtime.ts) | One LaunchDarkly server SDK client and one Anthropic client per server process |
| [`server/shopper.ts`](server/shopper.ts) | Validates the shopper sent by the browser and builds the context with the same `toLDContext()` the browser uses |
| [`api/assistant.ts`](api/assistant.ts), [`api/assistant-feedback.ts`](api/assistant-feedback.ts) | Vercel Functions. They flush analytics events after responding with `waitUntil` |
| [`web/src/components/ShoppingAssistant.tsx`](web/src/components/ShoppingAssistant.tsx) | The chat panel. It never talks to a model or a key directly |
| [`web/vite.config.ts`](web/vite.config.ts) | Serves the same handlers during `npm run dev` |

A few choices worth explaining:

- **Same context on both sides.** The server builds the shopper's context with the browser's `toLDContext()`. A shopper therefore gets the same targeting and the same experiment bucket in the chat as on the rest of the site, and the email stays a private attribute.
- **Config per request.** The server asks LaunchDarkly for the config on every request, with that shopper's context. LaunchDarkly evaluates it locally from memory, so this is fast. Reusing one config for everyone would ignore targeting.
- **Mapping to Anthropic.** AgentControl stores a prompt as role-tagged messages. Anthropic takes the system prompt as a separate field and needs the conversation to start with a user turn, so `toAnthropicMessages()` converts one shape into the other. Only two model parameters are forwarded, each checked first: `max_tokens` and `effort`. Current Claude models reject sampling parameters such as `temperature`, so passing every dashboard parameter through could break the assistant.
- **Tracking.** One tracker per answer records duration, token usage, and success or error with `trackMetricsOf`. There is no LaunchDarkly provider package for Anthropic, so a small extractor reads Claude's token counts; it reports a safety decline as an error, because the shopper got no answer. Feedback arrives later, in a separate request. The tracker's resumption token rebuilds the same run, so a thumbs up lands on the variation that earned it. The token reaches the browser only inside an HMAC signature, so a forged one is rejected.
- **Fallbacks.** If LaunchDarkly is unreachable, the code's fallback is "disabled", the same safe default every flag in this app uses. If the model call fails or declines, the shopper sees an apology instead of an error.
- **Which SDK.** This uses LaunchDarkly's stable Node AI SDK, `@launchdarkly/server-sdk-ai` v2, with the official `@anthropic-ai/sdk`. LaunchDarkly's newer `@launchdarkly/ai-node` (open beta) adds a Claude handler, `@launchdarkly/ai-claude-messages`, that does the mapping and tracking automatically. For a customer going to production today, the stable SDK is the safer choice, and it shows exactly what the beta automates.

### Production notes

- **Trusting the shopper.** This demo has no login, so the browser sends the shopper's attributes. A real store would build the context on the server from the signed-in account.
- **Abuse limits.** Every answer is a paid model call, so [`server/http.ts`](server/http.ts) checks each request before doing any work: POST only, `Content-Type: application/json` only (a browser cannot send JSON to another site without a CORS preflight, which this API never grants, so other sites cannot spend your budget through visitors' browsers), and a 20 KB body cap enforced while the body is read. [`server/config.ts`](server/config.ts) caps the question (500 characters), each earlier turn (1,500), the history (10 turns), and `max_tokens` (2,048). Those limit the size of one request, not how many arrive, so add a per-IP [rate limit in the Vercel Firewall](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) on `/api/` (for example 10 requests a minute) and a monthly spend limit in the Anthropic Console. When a demo period ends, turn the config's targeting **Off** in LaunchDarkly: the assistant then never calls a model.
- **Online evaluations.** AgentControl can attach built-in judges (accuracy, relevance, toxicity) that score a sample of answers. Those scores can serve as experiment metrics or as guardrails for a guarded rollout.

## Testing

Two layers of automated tests run on every pull request.

| Layer | Tool | What it proves |
|---|---|---|
| Unit and component (127 tests) | Vitest + React Testing Library | The assistant's server code (Anthropic message mapping, parameter filtering, fallbacks, product-link checks, the experiment events (kit value, free-shipping kits, response time), declines reported as errors, signed feedback tokens, history trimming), the API's request checks (POST only, JSON only, body size cap, and status codes that never leak internals), the AgentControl setup staying in step with the server, the chat panel, checkout validation, catalog lookups, the shipping rule, cart stock limits and persistence, contexts and private attributes, the evaluation-reason explainer, the hero's placeholder and fallback, and the flagged checkout drawer: Classic for `false`, Express for `true`, the `checkout-completed` event with the order total, the fallback when LaunchDarkly has no value, a live swap with toast and log, shopper switches labeled as switches, and listener cleanup |
| End to end (67 test runs) | Playwright in Chromium | The whole store in a real browser: every header, tile, chip, card, breadcrumb, and related-product link; all 25 product pages; size, color, and stock rules; the cart and drawer; both checkouts; the 404 page; phone layout. Plus both flags: **release and roll back mid-checkout with no page reload**; every Part 2 persona, rule, and attribute edit with the reason shown; a targeting change reaching the shopper live; contexts never in URLs and the private email never in events; the `checkout-completed` event carrying the order total; fallbacks when LaunchDarkly is unreachable; and the trail guide's answers, product cards, fallback, and feedback (with the server stubbed) |

### Phone layout

The store is responsive and was checked at iPhone width (390 px): nothing scrolls sideways, and the checkout drawer fills the screen with every field in view. To keep the suite readable, the automated phone checks are a single focused group (`tests/e2e/responsive.spec.ts`): no sideways scrolling on four key pages, the Release Console starting collapsed, and the checkout drawer fitting. Known limits on phones:

- **No category menu.** The header's category links (Packs, Footwear, and so on) are hidden at phone width. Shoppers browse through the hero button, the "Shop by trail need" tiles, and the shop page's filter chips instead. A production store would add a compact menu.
- **The open Release Console covers most of the screen.** It starts collapsed; collapse it again to watch the hero change.
- **The Winter-Ready hero has no dedicated phone test.** It was checked by hand at 390 px.

### How the flag is tested without a LaunchDarkly account

The end-to-end tests run the real LaunchDarkly React SDK against a small local mock of LaunchDarkly's client-side endpoints (`tests/mock-launchdarkly/server.mjs`). It speaks the same streaming protocol and evaluates the Part 2 targeting (individual targets, rules, a segment, and the default rule, in LaunchDarkly's order), so a test can open the checkout drawer, "save" a new flag value, and watch the drawer swap, or switch personas and check which rule LaunchDarkly reported. The app is pointed at the mock with three optional settings, `VITE_LD_BASE_URI`, `VITE_LD_STREAM_URI`, and `VITE_LD_EVENTS_URI`. Those are the same settings a customer uses to route the SDK through a [LaunchDarkly Relay Proxy](https://launchdarkly.com/docs/sdk/relay-proxy); leave them blank to connect to LaunchDarkly directly.

Every test runs against the Vite dev server, where React's StrictMode surfaces effect and cleanup bugs. The release-critical tests (tagged `@smoke`) also run against an optimized production build.

### Running the tests

```bash
npm test                          # unit and component tests, web and server (about 10 seconds)
npx playwright install chromium   # first time only: downloads the test browser
npm run test:e2e                  # end-to-end tests (about 3 minutes); starts its own servers
npm run test:e2e:ui               # the same, in Playwright's interactive UI
```

The end-to-end tests never contact real LaunchDarkly or Anthropic and do not use your `.env` keys. They need ports 5180, 5181, and 8787 free.

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
| Contexts and Live events stay empty, but flags work | Analytics events are being blocked. Ad blockers that use the EasyPrivacy filter list block `events.launchdarkly.com` (rule `\|\|events.launchdarkly.com^$third-party`), for example Brave Shields, and uBlock Origin, which enables that list by default. In DevTools > Network, those requests show `(blocked:other)`. Allow the domain or use a clean browser profile. Flags keep working, because the flag hosts (`clientsdk` and `clientstream.launchdarkly.com`) are not on the list and evaluation does not depend on events. |
| `npm run ld:setup` says the client-side ID belongs to another environment | Your app is connected to the environment it names. Set `LD_ENVIRONMENT_KEY` to that key, or copy the other environment's client-side ID into `.env`. Environments created at the same time have IDs that start with the same characters, so compare the whole ID. |
| Every persona gets the default rule | The app's client-side ID belongs to a different environment than the one you configured. `npm run ld:setup` detects this. |
| `npm run ld:setup` fails with HTTP 401 or 403 | The API token is missing, invalid, or lacks the Writer role. |
| `npm run remediate` fails with HTTP 404 | The trigger was reset or deleted. Create or reset it and update `.env`. |
| The Trail guide always says it is "off the clock" | Either the server keys are missing (the server log says so; add `LD_SDK_KEY` and `ANTHROPIC_API_KEY` and restart `npm run dev`, or add them in Vercel and redeploy), or the `shopping-assistant` config is Off, missing, or its default rule serves "disabled". Run `npm run ld:setup` and check the config's Targeting tab. |
| The Trail guide says it "lost the signal" | The model call failed: check the Anthropic key, the spend limit, and the server log. |
| The Monitoring tab stays empty | It fills about a minute after the first answers. Events come from the server, so browser ad blockers do not affect it. Most often `LD_SDK_KEY` is another environment's key (for example Production's while the app uses Test): check the other environment's Monitoring tab. `npm run ld:setup` warns when the key belongs to a different environment. `LD_LOG_LEVEL=debug` in `.env` shows the SDK's event delivery in the server log. |

---

## Project structure

```
switchback-supply/
  data/catalog.json             25 products, 109 SKUs (generated; also the assistant's product knowledge)
  web/                          React 19 + Vite + TypeScript storefront
    src/main.tsx                LaunchDarkly provider setup
    src/launchdarkly/           Flag keys, fallbacks, contexts, personas, reason explainer
    src/pages/                  Home, shop, product page, not found
    src/components/             Layout, product cards, checkout variants, Release Console, Trail guide chat
    src/state/                  Cart (persisted by SKU), toasts, and the listener log
    public/products/            Product photos (WebP, 800 x 800)
  server/                       AI shopping assistant: AgentControl config, Claude call, tracking (Node)
  api/                          Vercel Functions: /api/assistant and /api/assistant-feedback
  scripts/remediate.sh          Calls the flag trigger (Part 1 remediation)
  scripts/ld-setup.mjs          Applies the Part 2 flag, segment, and targeting, and the AgentControl config, through the REST API
  scripts/ld-ai-config.mjs      The assistant's config, three variations, prompts, and metric as data
  scripts/assistant-traffic.mjs Labeled synthetic shoppers for the experiment (real Claude replies)
  scripts/ld-targeting.mjs      The Part 2 configuration as data (reviewed in pull requests)
  scripts/ld-metrics.mjs        Part 1's checkout metrics as data
  scripts/catalog-source.py     Product copy, prices, and variants; generates data/catalog.json
  scripts/validate-catalog.mjs  Catalog checks run in CI
  vercel.json                   Build settings, function duration, and single-page app routing for Vercel
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
| `npm run ld:setup` | Create and target the Part 2 hero flag and segment, and the AgentControl config and metric, in LaunchDarkly (`-- --dry-run` to preview) |
| `npm run assistant:traffic` | Labeled synthetic shoppers for the AI experiment (`-- --dry-run` for the plan and cost estimate) |
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
- [Metrics](https://launchdarkly.com/docs/home/metrics), [Custom numeric metrics](https://launchdarkly.com/docs/home/metrics/custom-numeric), and [REST API: create metric](https://launchdarkly.com/docs/api/metrics/create-metric)
- [AgentControl (formerly AI Configs)](https://launchdarkly.com/docs/home/agentcontrol), [Creating configs](https://launchdarkly.com/docs/home/agentcontrol/create), [Variations](https://launchdarkly.com/docs/home/agentcontrol/create-variation), [Targeting](https://launchdarkly.com/docs/home/agentcontrol/target), and [Monitoring](https://launchdarkly.com/docs/home/agentcontrol/monitor)
- [Node.js AI SDK (stable)](https://launchdarkly.com/docs/sdk/ai/node-js-legacy), the newer [Node.js AI SDK (beta)](https://launchdarkly.com/docs/sdk/ai/node-js), and [Tracking AI metrics](https://launchdarkly.com/docs/sdk/features/ai-metrics)
- [Experimentation](https://launchdarkly.com/docs/home/experimentation), [Bayesian results](https://launchdarkly.com/docs/home/experimentation/bayesian), [Guardrail metrics](https://launchdarkly.com/docs/home/metrics/guardrail-metrics), [Experiments with AgentControl](https://launchdarkly.com/docs/home/agentcontrol/experimentation), [Online evaluations](https://launchdarkly.com/docs/home/agentcontrol/online-evaluations), and [Sending custom events](https://launchdarkly.com/docs/sdk/features/events)
- [Node.js server-side SDK](https://launchdarkly.com/docs/sdk/server-side/node-js) and the [AgentControl REST API](https://launchdarkly.com/docs/api/agentcontrol)

## About the catalog

Switchback Supply and every product are fictional. Product photos were generated with Leonardo.ai from prompts that exclude logos and text, then converted to 800 x 800 WebP (about 30 KB each). Prices, specs, and stock levels are invented. A few SKUs are deliberately sold out or low in stock, so product pages show real availability states. Both checkouts use the same shipping rule (free over $150, otherwise $8), so the feature flag changes the experience, never the price.

## How this was built

Built by David Rhodes with Claude Code as a pair programmer. Claude researched the current LaunchDarkly documentation and drafted each pull request; David reviewed, ran, and tested every change against a live LaunchDarkly environment before merging.

The guidance Claude Code works from is part of the repo: `CLAUDE.md` (project overview, commands, rules), `.claude/rules/` (LaunchDarkly SDK and testing conventions), and `docs/claude/` (the roadmap and the LaunchDarkly account setup this app expects).

## License

MIT. Switchback Supply is fictional. Product names and illustrations are invented for this demo.
