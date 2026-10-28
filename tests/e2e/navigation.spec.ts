import { catalog, expect, formatUSD, test } from './fixtures';

test.describe('navigation and links', () => {
  test('home page renders the hero, category tiles, and favorites @smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Switchback Supply/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/long way up/i);
    for (const c of catalog.categories) {
      await expect(page.getByRole('link', { name: new RegExp(`^.*${c.name}\\s+\\d+ items`) })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Trail favorites' })).toBeVisible();
  });

  test('hero call to action and "shop all" link open the full catalog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Shop the trail kit' }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole('heading', { level: 1, name: 'All gear' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: `Shop all ${catalog.products.length} items` }).click();
    await expect(page.getByRole('list').first().getByRole('listitem')).toHaveCount(catalog.products.length);
  });

  test('every header department link filters the shop', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Departments' });
    for (const c of catalog.categories) {
      await nav.getByRole('link', { name: c.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/shop\\?category=${c.id}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.name);
      const expected = catalog.products.filter((p) => p.category === c.id).length;
      await expect(page.locator('main .grid > li')).toHaveCount(expected);
    }
    await nav.getByRole('link', { name: 'All gear' }).click();
    await expect(page.locator('main .grid > li')).toHaveCount(catalog.products.length);
  });

  test('home category tiles open their category', async ({ page }) => {
    for (const c of catalog.categories) {
      await page.goto('/');
      await page.getByRole('link', { name: new RegExp(`${c.name}\\s+\\d+ items`) }).click();
      await expect(page).toHaveURL(new RegExp(`category=${c.id}`));
    }
  });

  test('filter chips update the URL and the product grid', async ({ page }) => {
    await page.goto('/shop');
    const chips = page.getByRole('group', { name: 'Filter by category' });
    await chips.getByRole('button', { name: 'Footwear' }).click();
    await expect(page).toHaveURL(/category=footwear/);
    await expect(chips.getByRole('button', { name: 'Footwear' })).toHaveAttribute('aria-pressed', 'true');
    await chips.getByRole('button', { name: 'All' }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('the logo returns home from any page', async ({ page }) => {
    await page.goto('/products/talus-mid');
    await page.getByRole('link', { name: 'Switchback Supply home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('every product page loads with its name, price, and photo', async ({ page }) => {
    test.setTimeout(120_000);
    for (const p of catalog.products) {
      await page.goto(`/products/${p.id}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.name);
      await expect(page.locator('.pdp__price')).toHaveText(formatUSD(p.price));
      await expect(page).toHaveTitle(`${p.name} | Switchback Supply`);
      const img = page.locator('.pdp__image img');
      await expect(img).toBeVisible();
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
  });

  test('product cards, breadcrumbs, and related products all link correctly', async ({ page }) => {
    await page.goto('/shop?category=footwear');
    await page.locator('a[href="/products/talus-mid"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Talus Mid Boot');

    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await crumbs.getByRole('link', { name: 'Footwear' }).click();
    await expect(page).toHaveURL(/category=footwear/);
    await page.goBack();
    await crumbs.getByRole('link', { name: 'Shop' }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await page.goBack();

    const related = page.locator('.pdp section a[href^="/products/"]').first();
    const href = await related.getAttribute('href');
    await related.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Talus Mid Boot');
  });

  test('unknown pages and products show the 404 page with a way back', async ({ page }) => {
    for (const path of ['/not-a-page', '/products/not-a-product']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'You wandered off trail.' })).toBeVisible();
    }
    await page.getByRole('link', { name: 'Back to the gear' }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('deep links work on a fresh load (single-page app routing) @smoke', async ({ page }) => {
    await page.goto('/products/cairn-poles');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cairn Expanding Carbon Poles');
    await page.goto('/shop?category=water');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Water');
  });
});
