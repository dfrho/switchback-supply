/** Switchback Supply wordmark: a trail zigzagging up a slope. */
export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <rect width="40" height="40" rx="9" fill="var(--forest)" />
        <path
          d="M9 31 L25 25 L13 19 L29 13 L19 8"
          fill="none"
          stroke="var(--blaze)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="19" cy="8" r="2.4" fill="var(--canvas)" />
      </svg>
      <span className="logo__word">
        Switchback<span>Supply</span>
      </span>
    </span>
  );
}

/** Decorative topographic contour lines used behind the hero. */
export function Contours() {
  const rings = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className="contours" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {rings.map((i) => (
        <path
          key={i}
          d={`M ${-40 + i * 6} ${330 - i * 26}
              C ${120 + i * 4} ${250 - i * 30}, ${220 - i * 6} ${360 - i * 18}, ${330 + i * 3} ${250 - i * 22}
              S ${520 - i * 8} ${150 - i * 12}, ${660} ${200 - i * 20}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={i % 4 === 0 ? 1.6 : 0.8}
        />
      ))}
    </svg>
  );
}
