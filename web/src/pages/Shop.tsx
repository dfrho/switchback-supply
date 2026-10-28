import { useSearchParams } from 'react-router';
import ProductCard from '../components/ProductCard';
import { CATEGORIES, PRODUCTS, getCategoryName } from '../data/catalog';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category');
  const validCategory = CATEGORIES.some((c) => c.id === category) ? category : null;
  const products = validCategory ? PRODUCTS.filter((p) => p.category === validCategory) : PRODUCTS;
  const heading = validCategory ? getCategoryName(validCategory) : 'All gear';
  usePageTitle(heading);

  const choose = (id: string | null) => setParams(id ? { category: id } : {});

  return (
    <main className="section section--page">
      <div className="section__head">
        <h1>{heading}</h1>
        <p className="muted">
          {products.length} {products.length === 1 ? 'item' : 'items'} · Free shipping on orders over $150
        </p>
      </div>

      <div className="chips" role="group" aria-label="Filter by category">
        <button className={`chip ${!validCategory ? 'is-active' : ''}`} onClick={() => choose(null)} aria-pressed={!validCategory}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`chip ${validCategory === c.id ? 'is-active' : ''}`}
            onClick={() => choose(c.id)}
            aria-pressed={validCategory === c.id}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ul className="grid">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </ul>
    </main>
  );
}
