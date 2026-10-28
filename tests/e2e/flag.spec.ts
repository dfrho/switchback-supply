import { FLAG, addToPack, cartButton, checkoutBadge, drawer, expect, openReleaseConsole, product, releaseConsole, test, waitForStreaming } from './fixtures';

/**
 * Part 1: Release and Remediate, end to end.
 * Mirrors the README demo walkthrough: open the checkout drawer, leave it open,
 * and flip release-new-checkout underneath it.
 */
test.describe('release-new-checkout flag @smoke', () => {
  const bottle = product('canyon-bottle');

  test('serves Classic checkout when the flag is off', async ({ page, ld }) => {
    await ld.reset({ [FLAG]: false });
    await page.goto('/');
    await waitForStreaming(page);
    await addToPack(page, bottle);
    await expect(checkoutBadge(page)).toHaveText('Classic checkout');
    await expect(drawer(page).getByRole('button', { name: 'Continue to payment' })).toBeVisible();
  });

  test('serves Express checkout when the flag is on', async ({ page, ld }) => {
    await ld.reset({ [FLAG]: true });
    await page.goto('/');
    await waitForStreaming(page);
    await addToPack(page, bottle);
    await expect(checkoutBadge(page)).toHaveText('Express checkout');
  });

  test('releases and rolls back live, mid-checkout, with no page reload', async ({ page, ld }) => {
    await ld.reset({ [FLAG]: false });
    await page.goto('/');
    await waitForStreaming(page);
    await addToPack(page, bottle);
    await expect(checkoutBadge(page)).toHaveText('Classic checkout');

    // A marker on the window survives only if the page is never reloaded.
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

    // Release: like saving "serve true" in LaunchDarkly.
    await ld.setFlag(FLAG, true);
    await expect(checkoutBadge(page)).toHaveText('Express checkout');
    await expect(page.getByRole('status').getByText('New checkout released')).toBeVisible();
    const consoleLog = releaseConsole(page);
    await expect(consoleLog.getByText('Released: Express checkout')).toBeVisible();

    // Roll back: like turning the flag off, or the remediation trigger firing.
    await ld.setFlag(FLAG, false);
    await expect(checkoutBadge(page)).toHaveText('Classic checkout');
    await expect(page.getByRole('status').getByText('Checkout rolled back')).toBeVisible();
    await expect(consoleLog.getByText('Rolled back: Classic checkout')).toBeVisible();

    // Same page the whole time, and the shopper's cart is untouched.
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    await expect(drawer(page).getByText(bottle.name)).toBeVisible();
  });

  test('a release reaches a shopper on any page, not just checkout', async ({ page, ld }) => {
    await ld.reset({ [FLAG]: false });
    await page.goto('/shop');
    await waitForStreaming(page);
    await ld.setFlag(FLAG, true);
    await expect(page.getByRole('status').getByText('New checkout released')).toBeVisible();
    await cartButton(page).click();
    await expect(checkoutBadge(page)).toHaveText('Express checkout');
  });
});

test.describe('test in production with individual targeting', () => {
  test('only the targeted QA tester sees Express checkout', async ({ page, ld }) => {
    await ld.reset({ [FLAG]: false });
    await ld.target(FLAG, 'qa-tester-001', true);
    await page.goto('/');
    await waitForStreaming(page);
    await addToPack(page, product('canyon-bottle'));
    await expect(checkoutBadge(page)).toHaveText('Classic checkout');

    const panel = releaseConsole(page);
    await panel.getByRole('radio', { name: 'Internal QA tester' }).click();
    await expect(panel.getByText('key: qa-tester-001')).toBeVisible();
    await expect(checkoutBadge(page)).toHaveText('Express checkout');

    await panel.getByRole('radio', { name: 'Guest shopper' }).click();
    await expect(checkoutBadge(page)).toHaveText('Classic checkout');
  });
});

test.describe('resilience', () => {
  test('falls back to Classic checkout when LaunchDarkly is unreachable @smoke', async ({ page }) => {
    // Block the (mock) LaunchDarkly endpoints entirely.
    await page.route('http://localhost:8787/**', (route) => route.abort());
    await page.goto('/');
    await addToPack(page, product('canyon-bottle'));
    await expect(checkoutBadge(page)).toHaveText('Classic checkout');
    await openReleaseConsole(page);
    await expect(releaseConsole(page).getByText('Streaming')).toHaveCount(0);
  });
});
