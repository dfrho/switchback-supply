import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  FLAT_SHIPPING,
  PRODUCTS,
  colorsOf,
  findVariant,
  getBySku,
  getProduct,
  isSoldOut,
  relatedTo,
  shippingFor,
  sizesOf,
} from './catalog';

describe('catalog data', () => {
  it('has 25 products across 6 categories with unique ids and SKUs', () => {
    expect(PRODUCTS).toHaveLength(25);
    expect(CATEGORIES).toHaveLength(6);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    const skus = PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
  });

  it('puts every product in a known category', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const p of PRODUCTS) expect(ids.has(p.category)).toBe(true);
  });

  it('keeps "expanding" in the Cairn poles name and description', () => {
    const poles = getProduct('cairn-poles')!;
    expect(poles.name).toMatch(/Expanding/);
    expect(poles.description).toMatch(/expanding/i);
  });
});

describe('lookups', () => {
  it('finds products by id and variants by SKU', () => {
    const boot = getProduct('talus-mid')!;
    const variant = boot.variants[0];
    expect(getBySku(variant.sku)?.product.id).toBe('talus-mid');
    expect(getProduct('does-not-exist')).toBeUndefined();
    expect(getProduct(undefined)).toBeUndefined();
  });

  it('lists distinct colors and sizes in display order', () => {
    const boot = getProduct('talus-mid')!;
    expect(colorsOf(boot).map((c) => c.name)).toEqual(['Brown', 'Graphite']);
    expect(sizesOf(boot)).toEqual(['8', '9', '10', '11', '12']);
    expect(sizesOf(getProduct('cairn-poles')!)).toEqual([]);
  });

  it('finds a variant by color and size, or by color alone for one-size products', () => {
    const boot = getProduct('talus-mid')!;
    expect(findVariant(boot, 'Graphite', '10')?.sku).toBe('SB-FW-TLSMD-GRA-10');
    const bottle = getProduct('canyon-bottle')!;
    expect(findVariant(bottle, 'Sage', null)?.sku).toBe('SB-WT-CNY32-SAG');
  });

  it('marks a color in stock when any of its sizes has stock', () => {
    for (const p of PRODUCTS) {
      for (const c of colorsOf(p)) {
        const anyStock = p.variants.some((v) => v.color === c.name && v.stock > 0);
        expect(c.inStock).toBe(anyStock);
      }
    }
  });

  it('only reports a product sold out when every variant is at zero', () => {
    for (const p of PRODUCTS) expect(isSoldOut(p)).toBe(p.variants.every((v) => v.stock === 0));
  });
});

describe('relatedTo', () => {
  it('returns up to four other products, same category first', () => {
    const boot = getProduct('talus-mid')!;
    const related = relatedTo(boot);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(related.some((p) => p.id === boot.id)).toBe(false);
    expect(related[0].category).toBe('footwear');
  });
});

describe('shippingFor', () => {
  it('charges flat shipping under $150 and ships free at $150 and above', () => {
    expect(shippingFor(149.99)).toBe(FLAT_SHIPPING);
    expect(shippingFor(150)).toBe(0);
    expect(shippingFor(527)).toBe(0);
  });
});
