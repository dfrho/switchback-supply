import { useState } from 'react';
import { Link, useParams } from 'react-router';
import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import {
  FREE_SHIPPING_MIN,
  colorsOf,
  findVariant,
  formatPrice,
  getCategoryName,
  getProduct,
  relatedTo,
  sizesOf,
  type Product,
} from '../data/catalog';
import { usePageTitle } from '../hooks/usePageTitle';
import { useCart } from '../state/Cart';
import NotFound from './NotFound';

const MAX_QTY = 10;

export default function ProductPage() {
  const { productId } = useParams();
  const product = getProduct(productId);
  if (!product) return <NotFound />;
  // key resets the selections when navigating between product pages.
  return <ProductDetail key={product.id} product={product} />;
}

function stockMessage(stock: number | undefined) {
  if (stock === undefined) return { tone: 'muted', text: 'Select a size to see availability' };
  if (stock === 0) return { tone: 'out', text: 'Sold out in this color and size' };
  if (stock <= 3) return { tone: 'low', text: `Only ${stock} left` };
  return { tone: 'ok', text: 'In stock, ships in 1 business day' };
}

function ProductDetail({ product }: { product: Product }) {
  usePageTitle(product.name);
  const { add, openCart } = useCart();
  const colors = colorsOf(product);
  const sizes = sizesOf(product);
  const hasSizes = sizes.length > 0;

  // Start on the first color that has stock. Shoppers must pick a size, like a real store.
  const [color, setColor] = useState(colors.find((c) => c.inStock)?.name ?? colors[0].name);
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const variant = hasSizes ? (size ? findVariant(product, color, size) : undefined) : findVariant(product, color, null);
  const stock = variant?.stock;
  const maxQty = Math.min(stock ?? 0, MAX_QTY);
  const message = stockMessage(stock);
  const canAdd = !!variant && variant.stock > 0;

  const chooseColor = (name: string) => {
    setColor(name);
    setQuantity(1);
    // Keep the chosen size only if it is in stock in the new color.
    if (size && (findVariant(product, name, size)?.stock ?? 0) === 0) setSize(null);
  };

  const handleAdd = () => {
    if (!variant) return;
    add(variant.sku, quantity);
    setQuantity(1);
    openCart();
  };

  const related = relatedTo(product);

  return (
    <main className="pdp">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/shop?category=${product.category}`}>{getCategoryName(product.category)}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pdp__main">
        <div className="pdp__media">
          <ProductImage product={product} priority className="pdp__image" />
        </div>

        <div className="pdp__buy">
          <p className="eyebrow">{getCategoryName(product.category)}</p>
          <h1 className="pdp__title">{product.name}</h1>
          <p className="pdp__price">{formatPrice(product.price)}</p>
          <p className="pdp__tagline">{product.tagline}</p>

          <fieldset className="picker">
            <legend>
              Color <span className="picker__value">{color}</span>
            </legend>
            <div className="picker__options">
              {colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`color-opt ${c.name === color ? 'is-active' : ''} ${!c.inStock ? 'is-out' : ''}`}
                  onClick={() => chooseColor(c.name)}
                  aria-pressed={c.name === color}
                  aria-label={`${c.name}${c.inStock ? '' : ', sold out'}`}
                  title={c.inStock ? c.name : `${c.name} (sold out)`}
                >
                  <span style={{ background: c.hex }} />
                </button>
              ))}
            </div>
          </fieldset>

          {hasSizes && (
            <fieldset className="picker">
              <legend>
                Size <span className="picker__value">{size ?? 'Select a size'}</span>
              </legend>
              <div className="picker__options">
                {sizes.map((s) => {
                  const sizeStock = findVariant(product, color, s)?.stock ?? 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`size-opt ${s === size ? 'is-active' : ''}`}
                      onClick={() => {
                        setSize(s);
                        setQuantity(1);
                      }}
                      disabled={sizeStock === 0}
                      aria-pressed={s === size}
                      aria-label={`Size ${s}${sizeStock === 0 ? ', sold out' : ''}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <p className={`stock stock--${message.tone}`}>{message.text}</p>

          <div className="pdp__actions">
            <div className="qty" aria-label="Quantity">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={!canAdd || quantity <= 1} aria-label="Decrease quantity">
                -
              </button>
              <span aria-live="polite">{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={!canAdd || quantity >= maxQty} aria-label="Increase quantity">
                +
              </button>
            </div>
            <button type="button" className="btn btn--primary btn--grow" onClick={handleAdd} disabled={!canAdd}>
              {hasSizes && !size ? 'Select a size' : canAdd ? 'Add to pack' : 'Sold out'}
            </button>
          </div>

          <ul className="perks">
            <li>Free shipping on orders over {formatPrice(FREE_SHIPPING_MIN)}</li>
            <li>30-day trail-tested returns</li>
            {variant && <li className="mono small">SKU {variant.sku}</li>}
          </ul>
        </div>
      </div>

      <section className="pdp__details">
        <div>
          <h2>Details</h2>
          <p>{product.description}</p>
          <h3>Features</h3>
          <ul className="features">
            {product.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Specs</h2>
          <dl className="specs">
            {product.specs.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section--flush">
          <div className="section__head">
            <h2>Pairs well with</h2>
          </div>
          <ul className="grid grid--four">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
