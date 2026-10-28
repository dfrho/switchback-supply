import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MOCK_LD = 'http://localhost:8787';
export const FLAG = 'release-new-checkout';

/** Controls the mock LaunchDarkly server: set flags, target contexts, reset between tests. */
export class MockLaunchDarkly {
  constructor(private readonly request: APIRequestContext) {}

  async reset(flags: Record<string, unknown> = {}) {
    await this.request.post(`${MOCK_LD}/__mock/reset`, { data: { flags } });
  }

  /** Change a flag's value for everyone, like saving the default rule in LaunchDarkly. */
  async setFlag(key: string, value: unknown) {
    const res = await this.request.post(`${MOCK_LD}/__mock/flags`, { data: { key, value } });
    expect(res.ok()).toBe(true);
  }

  /** Individually target one context key, like Target individuals in LaunchDarkly. */
  async target(flag: string, contextKey: string, value: unknown) {
    const res = await this.request.post(`${MOCK_LD}/__mock/targets`, { data: { flag, contextKey, value } });
    expect(res.ok()).toBe(true);
  }
}

export const test = base.extend<{ ld: MockLaunchDarkly }>({
  ld: async ({ request }, use) => {
    const ld = new MockLaunchDarkly(request);
    await ld.reset();
    await use(ld);
  },
  page: async ({ page }, use) => {
    // Never reach real LaunchDarkly or third parties from tests; fonts are cosmetic.
    await page.route(/launchdarkly\.com|fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await use(page);
  },
});

export { expect };

// ---------------------------------------------------------------------------
// Catalog-driven test data, so tests keep working when the catalog changes.
// ---------------------------------------------------------------------------
interface Variant {
  sku: string;
  color: string;
  colorHex: string;
  size: string | null;
  stock: number;
}
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  variants: Variant[];
}
export const catalog: { categories: { id: string; name: string }[]; products: Product[] } = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'data', 'catalog.json'), 'utf8'),
);

export const product = (id: string) => catalog.products.find((p) => p.id === id)!;

/** The color a product page selects first: the first color with any stock. */
export const defaultColor = (p: Product) => p.variants.find((v) => v.stock > 0)!.color;

export const formatUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------
export const drawer = (page: Page) => page.getByRole('complementary', { name: 'Checkout' });
export const checkoutBadge = (page: Page) => drawer(page).locator('.variant-tag');
export const cartButton = (page: Page) => page.getByRole('button', { name: /^Open your pack/ });
export const cartCount = (page: Page) => page.locator('.cart-btn__count');

export const releaseConsole = (page: Page) => page.getByRole('region', { name: 'LaunchDarkly release console' });

/** The Release Console starts collapsed; expand it if needed. */
export async function openReleaseConsole(page: Page) {
  const toggle = releaseConsole(page).getByRole('button', { name: 'Release console' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/** Wait until the SDK has its streaming connection to (mock) LaunchDarkly. */
export async function waitForStreaming(page: Page) {
  await openReleaseConsole(page);
  await expect(releaseConsole(page).getByText('Streaming')).toBeVisible();
}

/** Open a product page, choose a size if needed, and add it to the pack. */
export async function addToPack(page: Page, p: Product, opts: { size?: string; color?: string } = {}) {
  await page.goto(`/products/${p.id}`);
  if (opts.color) await page.getByRole('button', { name: opts.color, exact: true }).click();
  const color = opts.color ?? defaultColor(p);
  const hasSizes = p.variants.some((v) => v.size !== null);
  if (hasSizes) {
    const size = opts.size ?? p.variants.find((v) => v.color === color && v.stock > 0)!.size!;
    await page.getByRole('button', { name: `Size ${size}`, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Add to pack' }).click();
  await expect(drawer(page)).toBeVisible();
}

/** Fill and submit the Classic checkout's shipping and payment steps. */
export async function completeClassicDetails(page: Page) {
  await page.getByLabel('Full name').fill('Avery Reviewer');
  await page.getByLabel('Street').fill('100 Main St');
  await page.getByLabel('City').fill('Nashville');
  await page.getByLabel('State').fill('TN');
  await page.getByLabel('ZIP').fill('37203');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.getByLabel('Expiry').fill('12 / 30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: 'Continue to review' }).click();
}
