import { addToPack, cartButton, cartCount, catalog, defaultColor, drawer, expect, formatUSD, product, test } from './fixtures';

// Pick test data from the catalog so these tests keep working if stock changes.
const sized = catalog.products.filter((p) => p.variants.some((v) => v.size !== null));
const withSoldOutSize = sized.find((p) => {
  const color = defaultColor(p);
  return p.variants.some((v) => v.color === color && v.stock === 0);
});
const lowStock = catalog.products
  .flatMap((p) => p.variants.map((v) => ({ p, v })))
  .find(({ p, v }) => v.stock > 0 && v.stock <= 3 && p.variants.some((x) => x.size !== null));

test.describe('product page', () => {
  test('requires a size before adding sized products', async ({ page }) => {
    await page.goto('/products/talus-mid');
    const add = page.getByRole('button', { name: 'Select a size' });
    await expect(add).toBeDisabled();
    await expect(page.getByText('Select a size to see availability')).toBeVisible();
  });

  test('disables sold-out sizes', async ({ page }) => {
    test.skip(!withSoldOutSize, 'No sold-out size in the current catalog');
    const p = withSoldOutSize!;
    const color = defaultColor(p);
    const sold = p.variants.find((v) => v.color === color && v.stock === 0)!;
    await page.goto(`/products/${p.id}`);
    await expect(page.getByRole('button', { name: `Size ${sold.size}, sold out` })).toBeDisabled();
  });

  test('shows low stock and caps quantity at what is available', async ({ page }) => {
    test.skip(!lowStock, 'No low-stock sized variant in the current catalog');
    const { p, v } = lowStock!;
    await page.goto(`/products/${p.id}`);
    await page.getByRole('button', { name: v.color, exact: true }).click();
    await page.getByRole('button', { name: `Size ${v.size}`, exact: true }).click();
    await expect(page.getByText(`Only ${v.stock} left`)).toBeVisible();
    const increase = page.locator('.pdp__actions').getByRole('button', { name: 'Increase quantity' });
    for (let i = 1; i < v.stock; i += 1) await increase.click();
    await expect(page.locator('.pdp__actions .qty span')).toHaveText(String(v.stock));
    await expect(increase).toBeDisabled();
  });

  test('switching color updates the selected color label and SKU', async ({ page }) => {
    const shell = product('squall-shell');
    await page.goto('/products/squall-shell');
    await page.getByRole('button', { name: 'Black', exact: true }).click();
    await expect(page.locator('.picker__value').first()).toHaveText('Black');
    const size = shell.variants.find((v) => v.color === 'Black' && v.stock > 0)!;
    await page.getByRole('button', { name: `Size ${size.size}`, exact: true }).click();
    await expect(page.getByText(`SKU ${size.sku}`)).toBeVisible();
  });
});

test.describe('cart and checkout drawer', () => {
  test('adding to the pack opens the drawer with the right line item @smoke', async ({ page }) => {
    const boot = product('talus-mid');
    const color = defaultColor(boot);
    const variant = boot.variants.find((v) => v.color === color && v.stock > 0)!;
    await addToPack(page, boot, { size: variant.size! });
    const d = drawer(page);
    await expect(d.getByRole('link', { name: boot.name })).toBeVisible();
    await expect(d.getByText(`${color} · Size ${variant.size}`)).toBeVisible();
    await expect(d.locator('.line-item__price')).toHaveText(formatUSD(boot.price));
    await expect(cartCount(page)).toHaveText('1');
  });

  test('quantity buttons update the line total and the header count', async ({ page }) => {
    const bottle = product('canyon-bottle');
    await addToPack(page, bottle);
    const d = drawer(page);
    await d.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(d.locator('.line-item__price')).toHaveText(formatUSD(bottle.price * 2));
    await expect(cartCount(page)).toHaveText('2');
    await d.getByRole('button', { name: 'Decrease quantity' }).click();
    await expect(cartCount(page)).toHaveText('1');
  });

  test('removing the last item shows the empty state with a way back to shopping', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    await drawer(page).getByRole('button', { name: 'Remove' }).click();
    await expect(drawer(page).getByText('Your pack is empty.')).toBeVisible();
    await drawer(page).getByRole('link', { name: 'Shop the trail kit' }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(drawer(page)).toBeHidden();
  });

  test('the drawer closes with the close button, Escape, and the backdrop', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    await drawer(page).getByRole('button', { name: 'Close checkout' }).click();
    await expect(drawer(page)).toBeHidden();
    await cartButton(page).click();
    await expect(drawer(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
    await cartButton(page).click();
    await page.mouse.click(200, 150); // the dimmed backdrop, left of the drawer
    await expect(drawer(page)).toBeHidden();
  });

  test('the cart survives a page refresh', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    await page.reload();
    await expect(cartCount(page)).toHaveText('1');
    await cartButton(page).click();
    await expect(drawer(page).getByRole('link', { name: 'Canyon 32 oz Insulated Bottle' })).toBeVisible();
  });

  test('line item links go to the product page and close the drawer', async ({ page }) => {
    await addToPack(page, product('canyon-bottle'));
    await page.goto('/shop');
    await cartButton(page).click();
    await drawer(page).getByRole('link', { name: 'Canyon 32 oz Insulated Bottle' }).click();
    await expect(page).toHaveURL(/\/products\/canyon-bottle$/);
    await expect(drawer(page)).toBeHidden();
  });
});
