#!/usr/bin/env node
/**
 * Validates data/catalog.json so a bad edit fails CI instead of the storefront.
 * Run: npm run validate:catalog
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'data', 'catalog.json'), 'utf8'));
const publicDir = join(root, 'web', 'public');

const errors = [];
const warnings = [];
const categoryIds = new Set(catalog.categories.map((c) => c.id));
const productIds = new Set();
const skus = new Set();
const ART = new Set(['pack', 'boot', 'shell', 'headlamp', 'poles', 'filter', 'tent', 'roll', 'stove', 'chair', 'lantern', 'bottle']);

for (const p of catalog.products) {
  const where = `product "${p.id}"`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errors.push(`${where}: id must be lowercase kebab-case`);
  if (productIds.has(p.id)) errors.push(`${where}: duplicate product id`);
  productIds.add(p.id);
  if (!categoryIds.has(p.category)) errors.push(`${where}: unknown category "${p.category}"`);
  if (!(typeof p.price === 'number' && p.price > 0)) errors.push(`${where}: price must be a positive number`);
  for (const field of ['name', 'tagline', 'description']) {
    if (typeof p[field] !== 'string' || !p[field].trim()) errors.push(`${where}: missing ${field}`);
  }
  if (!ART.has(p.art)) errors.push(`${where}: unknown art "${p.art}"`);
  if (!/^#[0-9a-f]{6}$/i.test(p.tone)) errors.push(`${where}: tone must be a hex color`);
  if (!Array.isArray(p.variants) || p.variants.length === 0) errors.push(`${where}: needs at least one variant`);
  if (p.image !== null && typeof p.image !== 'string') errors.push(`${where}: image must be a path or null`);
  if (typeof p.image === 'string' && !existsSync(join(publicDir, p.image))) {
    errors.push(`${where}: image file web/public${p.image} does not exist`);
  }
  for (const v of p.variants ?? []) {
    if (skus.has(v.sku)) errors.push(`${where}: duplicate SKU ${v.sku}`);
    skus.add(v.sku);
    if (!Number.isInteger(v.stock) || v.stock < 0) errors.push(`${where}: ${v.sku} stock must be a whole number, 0 or more`);
    if (!/^#[0-9a-f]{6}$/i.test(v.colorHex)) errors.push(`${where}: ${v.sku} colorHex must be a hex color`);
  }
}

// Images on disk that no product references (likely a naming mismatch).
const productsDir = join(publicDir, 'products');
if (existsSync(productsDir)) {
  const referenced = new Set(catalog.products.map((p) => p.image).filter(Boolean));
  for (const file of readdirSync(productsDir)) {
    if (!referenced.has(`/products/${file}`)) warnings.push(`web/public/products/${file} is not referenced by any product`);
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nCatalog invalid: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Catalog OK: ${catalog.products.length} products, ${skus.size} SKUs, ${catalog.categories.length} categories.`);
