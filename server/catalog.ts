import catalog from '../data/catalog.json' with { type: 'json' };

/**
 * Product knowledge for the assistant. The full catalog is about 47 KB; the
 * prompt only needs enough to recommend well, so each product becomes one line.
 * This text fills the {{catalog}} variable in the AgentControl prompt.
 */

interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  tagline: string;
  tags: string[];
  variants: { stock: number }[];
}

const products = catalog.products as CatalogProduct[];

export const PRODUCT_IDS: ReadonlySet<string> = new Set(products.map((p) => p.id));

export const PRODUCT_NAMES: ReadonlyMap<string, string> = new Map(products.map((p) => [p.id, p.name]));

export function compactCatalog(): string {
  return products
    .map((p) => {
      const inStock = p.variants.some((v) => v.stock > 0);
      return `- ${p.id} | ${p.name} | ${p.category} | $${p.price} | ${p.tagline} | tags: ${p.tags.join(', ')}${inStock ? '' : ' | OUT OF STOCK'}`;
    })
    .join('\n');
}

/**
 * Finds product links in a reply and keeps only ids that exist in the catalog.
 * A model can invent a plausible id; those links are dropped here (and rendered
 * as plain text in the browser), so a made-up product never counts as a recommendation.
 */
export function findRecommendedProducts(reply: string): string[] {
  const ids = [...reply.matchAll(/\/products\/([a-z0-9-]+)/g)].map((m) => m[1]);
  return [...new Set(ids)].filter((id) => PRODUCT_IDS.has(id));
}
