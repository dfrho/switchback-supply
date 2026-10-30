import { FLAG, addToPack, cartCount, completeClassicDetails, drawer, expect, formatUSD, product, test, waitForStreaming } from './fixtures';

test.describe('Classic checkout (flag off)', () => {
  test.beforeEach(async ({ ld }) => ld.reset({ [FLAG]: false }));

  test('starts with empty fields and blocks an incomplete step', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    for (const label of ['Full name', 'Street', 'City', 'State', 'ZIP']) {
      await expect(drawer(page).getByLabel(label)).toHaveValue('');
    }
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByText('Enter your full name')).toBeVisible();
    await expect(page.getByText('Enter a 5-digit ZIP code')).toBeVisible();
    await expect(drawer(page).getByLabel('Full name')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
  });

  test('rejects an expired card', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    await drawer(page).getByLabel('Full name').fill('Avery Reviewer');
    await drawer(page).getByLabel('Street').fill('100 Main St');
    await drawer(page).getByLabel('City').fill('Nashville');
    await drawer(page).getByLabel('State').fill('TN');
    await drawer(page).getByLabel('ZIP').fill('37203');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await drawer(page).getByLabel('Card number').fill('4242 4242 4242 4242');
    await drawer(page).getByLabel('Expiry').fill('01 / 20');
    await drawer(page).getByLabel('CVC').fill('123');
    await page.getByRole('button', { name: 'Continue to review' }).click();
    await expect(page.getByText('This card has expired')).toBeVisible();
  });

  test('places an order end to end and empties the cart @smoke', async ({ page }) => {
    await page.goto('/');
    await waitForStreaming(page);
    await addToPack(page, product('canyon-bottle'));
    await completeClassicDetails(page);
    const review = drawer(page).locator('.review-summary');
    await expect(review).toContainText('Avery Reviewer');
    await expect(review).toContainText('100 Main St, Nashville, TN 37203');
    await expect(review).toContainText('Card ending 4242');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(drawer(page).getByRole('heading', { name: 'See you on the trail.' })).toBeVisible();
    await expect(cartCount(page)).toHaveText('0');
  });

  test('Back keeps what the shopper already typed', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    await completeClassicDetails(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(drawer(page).getByLabel('Card number')).toHaveValue('4242 4242 4242 4242');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(drawer(page).getByLabel('Full name')).toHaveValue('Avery Reviewer');
  });

  test('charges $8 shipping under $150 and ships free at $150 and over', async ({ page }) => {
    const bottle = product('canyon-bottle');
    await addToPack(page, bottle);
    await completeClassicDetails(page);
    const totals = drawer(page).locator('.totals');
    await expect(totals).toContainText(formatUSD(8));
    await expect(totals).toContainText(formatUSD(bottle.price + 8));

    const pack = product('ridgeline-45');
    await addToPack(page, pack);
    await completeClassicDetails(page);
    await expect(drawer(page).locator('.totals')).toContainText('Free');
    await expect(drawer(page).locator('.totals')).toContainText(formatUSD(bottle.price + pack.price));
  });
});

test.describe('Express checkout (flag on)', () => {
  test('places an order in one tap with the same pricing rule @smoke', async ({ page, ld }) => {
    await ld.reset({ [FLAG]: true });
    const bottle = product('canyon-bottle');
    await page.goto('/');
    await waitForStreaming(page);
    await addToPack(page, bottle);
    await expect(drawer(page).getByText('Shipping')).toBeVisible();
    const placeOrder = drawer(page).getByRole('button', { name: `Place order, ${formatUSD(bottle.price + 8)}` });
    await placeOrder.click();
    await expect(drawer(page).getByRole('heading', { name: 'See you on the trail.' })).toBeVisible();
    await expect(cartCount(page)).toHaveText('0');
  });

  test('sends a checkout-completed event with the order total, for metrics', async ({ page, ld }) => {
    await ld.reset({ [FLAG]: true });
    const bottle = product('canyon-bottle');
    await page.goto('/');
    await waitForStreaming(page);
    await addToPack(page, bottle);
    await drawer(page).getByRole('button', { name: /^Place order/ }).click();
    // The SDK batches analytics events and sends them a few seconds later.
    const completed = async () =>
      (await ld.eventPayloads())
        .flatMap((payload) => JSON.parse(payload) as { kind: string; key?: string; data?: unknown; metricValue?: number }[])
        .find((event) => event.kind === 'custom' && event.key === 'checkout-completed');
    await expect.poll(completed, { timeout: 20_000 }).toMatchObject({
      data: { checkout: 'express', items: 1 },
      metricValue: bottle.price + 8,
    });
  });
});
