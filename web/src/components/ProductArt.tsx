import type { ProductArtKind } from '../data/catalog';

/**
 * Hand-drawn style product illustrations. Used whenever a product has no photo
 * yet (or a photo fails to load), so the storefront never shows a broken image.
 */
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
          <path d="M47 58 H53 M73 58 H67" />
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
      {kind === 'tent' && (
        <g {...stroke}>
          <path d="M16 92 L60 26 L104 92 Z" fill="var(--canvas)" />
          <path d="M60 26 L60 92 M44 92 L60 60 L76 92" />
          <path d="M10 92 H110" />
          <path d="M60 26 L60 16" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'roll' && (
        <g {...stroke}>
          <rect x="28" y="38" width="64" height="44" rx="22" fill="var(--canvas)" />
          <ellipse cx="50" cy="60" rx="10" ry="22" />
          <path d="M66 38 V82 M78 40 V80" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'stove' && (
        <g {...stroke}>
          <path d="M40 70 H80 L76 100 H44 Z" fill="var(--canvas)" />
          <path d="M50 70 V58 H70 V70" />
          <path d="M38 58 L50 50 M82 58 L70 50" />
          <path d="M54 46 Q60 34 56 26 M64 46 Q70 36 66 28" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'chair' && (
        <g {...stroke}>
          <path d="M36 30 Q60 24 84 30 L80 70 H40 Z" fill="var(--canvas)" />
          <path d="M40 70 L30 100 M80 70 L90 100 M40 70 L90 100 M80 70 L30 100" />
          <path d="M36 30 L40 70 M84 30 L80 70" stroke="var(--blaze)" />
        </g>
      )}
      {kind === 'lantern' && (
        <g {...stroke}>
          <path d="M52 18 Q60 10 68 18" />
          <rect x="42" y="26" width="36" height="12" rx="4" fill="var(--canvas)" />
          <path d="M44 38 Q36 66 44 92 H76 Q84 66 76 38" fill="var(--canvas)" />
          <circle cx="60" cy="64" r="9" fill="var(--blaze)" stroke="var(--forest)" />
          <path d="M42 92 H78" />
        </g>
      )}
      {kind === 'bottle' && (
        <g {...stroke}>
          <rect x="50" y="14" width="20" height="14" rx="4" />
          <path d="M44 32 Q44 28 50 28 H70 Q76 28 76 32 V100 Q76 104 72 104 H48 Q44 104 44 100 Z" fill="var(--canvas)" />
          <path d="M44 52 H76 M44 84 H76" stroke="var(--blaze)" />
        </g>
      )}
    </svg>
  );
}
