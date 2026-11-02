import { HERO_FLAG, HERO_TARGETING, SEGMENTS, expect, openReleaseConsole, releaseConsole, test, type MockLaunchDarkly } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Part 2: Target, end to end.
 * The mock applies the README's targeting for release-landing-hero:
 *   individual target qa-tester-001, then
 *   1. Employees (email ends with @switchbacksupply.test)
 *   2. Beta shoppers (segment: betaTester is true)
 *   3. Gold members in Central states (loyaltyTier gold AND state in TN, TX, IL, MN, CO)
 *   then the default rule (current hero).
 */
const hero = (page: Page) => page.locator('[data-hero]');
const decision = (page: Page) => releaseConsole(page).getByTestId('hero-decision');
const row = (page: Page, id: string) => releaseConsole(page).locator(`[data-row="${id}"]`);

async function setup(page: Page, ld: MockLaunchDarkly) {
  await ld.reset({ [HERO_FLAG]: HERO_TARGETING }, SEGMENTS);
  await page.goto('/');
  await openReleaseConsole(page);
  await expect(releaseConsole(page).getByText('Streaming')).toBeVisible();
}

const persona = (page: Page, id: string) => releaseConsole(page).getByLabel('Persona').selectOption(id);

test.describe('release-landing-hero targeting', () => {
  test('a guest matches nothing and gets the current hero @smoke', async ({ page, ld }) => {
    await setup(page, ld);
    await expect(hero(page)).toHaveAttribute('data-hero', 'current');
    await expect(decision(page)).toHaveText('No targeting matched; default rule served');
    await expect(row(page, 'default')).toContainText('Match');
    await expect(row(page, 'rule-1')).toContainText('No match');
  });

  test('individual targeting: the QA tester gets the Winter-Ready hero', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'qa');
    await expect(hero(page)).toHaveAttribute('data-hero', 'winter-ready');
    await expect(decision(page)).toHaveText('Individually targeted');
    await expect(row(page, 'individual')).toContainText('Match');
    await expect(row(page, 'rule-1')).toContainText('Not evaluated');
  });

  test('rule 1: an employee matches through the private email attribute', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'employee');
    await expect(hero(page)).toHaveAttribute('data-hero', 'winter-ready');
    await expect(decision(page)).toHaveText('Matched rule 1: Employees');
  });

  test('rule 2: a beta tester matches through the beta-shoppers segment', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'beta');
    await expect(hero(page)).toHaveAttribute('data-hero', 'winter-ready');
    await expect(decision(page)).toHaveText('Matched rule 2: Beta shoppers');
    await expect(row(page, 'rule-1')).toContainText('No match');
    await expect(row(page, 'rule-3')).toContainText('Not evaluated');
  });

  test('rule 3: a Gold member in a Central state matches; moving out of the region does not @smoke', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'gold');
    await expect(hero(page)).toHaveAttribute('data-hero', 'winter-ready');
    await expect(decision(page)).toHaveText('Matched rule 3: Gold members in Central states');

    await releaseConsole(page).getByLabel('State').selectOption('CA');
    await expect(hero(page)).toHaveAttribute('data-hero', 'current');
    await expect(decision(page)).toHaveText('No targeting matched; default rule served');
  });

  test('Reset undoes attribute edits, and LaunchDarkly re-evaluates the original shopper', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'gold');
    await releaseConsole(page).getByLabel('State').selectOption('CA');
    await expect(decision(page)).toHaveText('No targeting matched; default rule served');
    await expect(releaseConsole(page).getByTestId('context-key')).toContainText('edited');

    // Re-picking the persona already selected would not fire; Reset is the one-click undo.
    await releaseConsole(page).getByRole('button', { name: 'Reset Gold member, Nashville to its original attributes' }).click();

    await expect(decision(page)).toHaveText('Matched rule 3: Gold members in Central states');
    await expect(hero(page)).toHaveAttribute('data-hero', 'winter-ready');
    await expect(releaseConsole(page).getByLabel('State')).toHaveValue('TN');
    await expect(releaseConsole(page).getByTestId('context-key')).not.toContainText('edited');
  });

  test('editing attributes re-evaluates live, and the first matching rule wins', async ({ page, ld }) => {
    await setup(page, ld);
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    const panel = releaseConsole(page);

    await panel.getByLabel('Loyalty tier').selectOption('gold');
    await panel.getByLabel('State').selectOption('TX');
    await expect(decision(page)).toHaveText('Matched rule 3: Gold members in Central states');

    await panel.getByRole('switch', { name: /Beta tester/ }).check();
    await expect(decision(page)).toHaveText('Matched rule 2: Beta shoppers');

    await panel.getByRole('switch', { name: /Employee email/ }).check();
    await expect(decision(page)).toHaveText('Matched rule 1: Employees');
    await expect(row(page, 'rule-2')).toContainText('Not evaluated');

    await panel.getByRole('switch', { name: /Employee email/ }).uncheck();
    await panel.getByRole('switch', { name: /Beta tester/ }).uncheck();
    await panel.getByLabel('Loyalty tier').selectOption('none');
    await expect(hero(page)).toHaveAttribute('data-hero', 'current');
    await expect(panel.getByTestId('context-key')).toContainText('edited');

    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  });

  test('a rule change in LaunchDarkly reaches the shopper live', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'qa');
    await expect(hero(page)).toHaveAttribute('data-hero', 'winter-ready');
    // Like removing the QA tester from individual targets in the dashboard.
    await ld.target(HERO_FLAG, 'qa-tester-001', false);
    await expect(hero(page)).toHaveAttribute('data-hero', 'current');
  });
});

test.describe('privacy', () => {
  test('the shopper context travels in request bodies, never in URLs', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'employee');
    await expect(decision(page)).toHaveText('Matched rule 1: Employees');
    const requests = await ld.requests();
    expect(requests.some((r) => r.startsWith('REPORT /sdk/evalx/'))).toBe(true);
    // In GET mode the context would be base64-encoded into /eval/... or /contexts/... paths.
    expect(requests.filter((r) => r.startsWith('GET /eval/') || r.includes('/contexts/'))).toEqual([]);
  });

  test('the private email is used for targeting but never sent in analytics events', async ({ page, ld }) => {
    await setup(page, ld);
    await persona(page, 'employee');
    await expect(decision(page)).toHaveText('Matched rule 1: Employees');
    // The SDK flushes events periodically; wait until the employee context has been reported.
    await expect.poll(async () => (await ld.eventPayloads()).join('\n'), { timeout: 20_000 }).toContain('employee-001');
    const events = (await ld.eventPayloads()).join('\n');
    expect(events).not.toContain('merch@switchbacksupply.test');
    expect(events).toContain('redactedAttributes');
  });
});

test.describe('first load', () => {
  test('falls back to the current hero when LaunchDarkly is unreachable @smoke', async ({ page }) => {
    await page.route('http://localhost:8787/**', (route) => route.abort());
    await page.goto('/');
    await expect(hero(page)).toHaveAttribute('data-hero', 'current', { timeout: 5_000 });
  });
});
