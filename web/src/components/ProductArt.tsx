import type { ProductArtKind } from '../data/products';

/** Simple hand-drawn style product illustrations (no stock photos). */
export default function ProductArt({ kind }: { kind: ProductArtKind }) {
  const stroke = { fill: 'none', stroke: 'var(--forest)', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg viewBox="0 0 120 120" className="product-art" aria-hidden="true">
      {kind === 'pack' && (
        <g {...stroke}>
          <path d="M40 30 Q60 14 80 30 L84 96 Q60 104 36 96 Z" fill="var(--canvas)" />
          <path d="M44 52 H76 V80 H44 Z" />
          <path d="M48 30 Q60 22 72 30" />
          <path d="M34 70 H26 M86 70 H94" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'boot' && (
        <g {...stroke}>
          <path d="M34 28 H58 L62 66 Q82 68 92 80 V92 H26 V44 Z" fill="var(--canvas)" />
          <path d="M26 92 H92" strokeWidth="6" />
          <path d="M40 40 H54 M40 50 H56 M40 60 H58" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'shell' && (
        <g {...stroke}>
          <path d="M44 22 L60 30 L76 22 L96 40 L88 54 L80 48 V98 H40 V48 L32 54 L24 40 Z" fill="var(--canvas)" />
          <path d="M60 30 V98" />
          <path d="M50 22 Q60 8 70 22" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'headlamp' && (
        <g {...stroke}>
          <ellipse cx="60" cy="62" rx="40" ry="20" />
          <rect x="44" y="50" width="32" height="24" rx="8" fill="var(--canvas)" />
          <circle cx="60" cy="62" r="7" fill="var(--blaze)" stroke="var(--forest)" />
          <path d="M60 30 V20 M44 34 L38 26 M76 34 L82 26" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'poles' && (
        <g {...stroke}>
          <path d="M44 18 L52 102 M76 18 L68 102" />
          <path d="M40 18 H50 V34 H40 Z M70 18 H80 V34 H70 Z" fill="var(--blaze)" />
          <circle cx="51" cy="92" r="5" />
          <circle cx="69" cy="92" r="5" />
        </g>
      )}
      {kind === 'filter' && (
        <g {...stroke}>
          <path d="M46 40 H74 L78 98 H42 Z" fill="var(--canvas)" />
          <rect x="50" y="24" width="20" height="16" rx="3" />
          <path d="M48 64 Q60 56 72 64 Q60 72 48 64" stroke="var(--blaze)" />
          <path d="M60 14 V24" />
        </g>
      )}
    </svg>
  );
}
