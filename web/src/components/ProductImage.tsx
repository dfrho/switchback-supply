import { useState } from 'react';
import type { Product } from '../data/catalog';
import ProductArt from './ProductArt';

interface Props {
  product: Product;
  /** Load eagerly on product pages; lazily in grids. */
  priority?: boolean;
  className?: string;
}

/** Product photo when one exists, otherwise the illustration on the product's tone color. */
export default function ProductImage({ product, priority = false, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const showPhoto = product.image && !failed;

  return (
    <div className={`product-image ${showPhoto ? 'product-image--photo' : ''} ${className}`} style={{ background: product.tone }}>
      {showPhoto ? (
        <img
          src={product.image!}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          width={800}
          height={800}
          onError={() => setFailed(true)}
        />
      ) : (
        <ProductArt kind={product.art} />
      )}
    </div>
  );
}
