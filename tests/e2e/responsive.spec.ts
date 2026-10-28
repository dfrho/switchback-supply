import { addToPack, drawer, expect, product, test } from './fixtures';

test.describe('phone layout (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ['/', '/shop', '/products/squall-shell', '/products/cairn-poles']) {
    test(`no sideways scrolling on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('the Release Console starts collapsed so it does not cover the page', async ({ page }) => {
    await page.goto('/products/squall-shell');
    const releaseConsole = page.getByRole('region', { name: 'LaunchDarkly release console' });
    await expect(releaseConsole.getByRole('button', { name: 'Release console' })).toHaveAttribute('aria-expanded', 'false');
    await expect(releaseConsole.getByText('Listener log')).toHaveCount(0);
  });

  test('the checkout drawer fills the screen and its fields fit', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    const box = await drawer(page).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(388);
    const fieldOverflow = await drawer(page).evaluate((el) =>
      [...el.querySelectorAll('input')].some((input) => input.getBoundingClientRect().right > window.innerWidth),
    );
    expect(fieldOverflow).toBe(false);
  });
});
