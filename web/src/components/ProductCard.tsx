import { Link } from 'react-router';
import { colorsOf, formatPrice, getCategoryName, isSoldOut, type Product } from '../data/catalog';
import ProductImage from './ProductImage';

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const colors = colorsOf(product);
  const soldOut = isSoldOut(product);

  return (
    <li className="card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
      <Link to={`/products/${product.id}`} className="card__link">
        <div className="card__art">
          <ProductImage product={product} />
          <span className="card__cat">{getCategoryName(product.category)}</span>
          {soldOut && <span className="card__badge">Sold out</span>}
        </div>
        <div className="card__body">
          <h3>{product.name}</h3>
          <p className="card__blurb">{product.tagline}</p>
          <div className="card__foot">
            <span className="card__price">{formatPrice(product.price)}</span>
            <span className="swatches" aria-label={`${colors.length} colors`}>
              {colors.map((c) => (
                <span key={c.name} className="swatch-dot" style={{ background: c.hex }} title={c.name} />
              ))}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
