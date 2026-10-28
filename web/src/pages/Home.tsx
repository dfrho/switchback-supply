import { Link } from 'react-router';
import { Contours } from '../components/Brand';
import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import { CATEGORIES, PRODUCTS } from '../data/catalog';
import { usePageTitle } from '../hooks/usePageTitle';

const FEATURED_IDS = [
  'ridgeline-45',
  'talus-mid',
  'squall-shell',
  'cairn-poles',
  'bivouac-2',
  'ember-puffer',
  'alpenglow-400',
  'spring-filter',
];

export default function Home() {
  usePageTitle();
  const featured = FEATURED_IDS.map((id) => PRODUCTS.find((p) => p.id === id)!).filter(Boolean);

  return (
    <>
      {/* Part 2 wraps this hero in a targeted feature flag. */}
      <section className="hero">
        <Contours />
        <div className="hero__copy">
          <p className="eyebrow">Fall trail season</p>
          <h1 className="hero__title">
            Gear for the
            <br />
            long way up.
          </h1>
          <p className="hero__sub">
            Field-tested packs, boots, and shells for every switchback between the trailhead and the summit.
          </p>
          <Link className="btn btn--primary" to="/shop">
            Shop the trail kit
          </Link>
        </div>
        <div className="hero__marker" aria-hidden="true">
          <span>EL. 6,643 FT</span>
          <span>MILE 12.4</span>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Shop by trail need</h2>
        </div>
        <ul className="cat-tiles">
          {CATEGORIES.map((c) => {
            const lead = PRODUCTS.find((p) => p.category === c.id)!;
            const count = PRODUCTS.filter((p) => p.category === c.id).length;
            return (
              <li key={c.id}>
                <Link to={`/shop?category=${c.id}`} className="cat-tile">
                  <ProductImage product={lead} />
                  <span className="cat-tile__name">{c.name}</span>
                  <span className="cat-tile__count">{count} items</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Trail favorites</h2>
          <Link to="/shop" className="text-link">
            Shop all {PRODUCTS.length} items
          </Link>
        </div>
        <ul className="grid">
          {featured.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </ul>
      </section>
    </>
  );
}
