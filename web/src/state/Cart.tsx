import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBySku, type Product, type Variant } from '../data/catalog';

/** Lines are stored by SKU; product details are looked up from the catalog. */
interface StoredLine {
  sku: string;
  quantity: number;
}

export interface CartLine {
  sku: string;
  quantity: number;
  product: Product;
  variant: Variant;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (sku: string, quantity?: number) => void;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);
const STORAGE_KEY = 'switchback.cart.v1';

/** Restore the cart after a refresh. Unknown SKUs are dropped; quantities are capped at stock. */
function loadStoredLines(): StoredLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is StoredLine => typeof l?.sku === 'string' && Number.isInteger(l?.quantity))
      .map((l) => {
        const found = getBySku(l.sku);
        return found ? { sku: l.sku, quantity: Math.min(l.quantity, found.variant.stock) } : null;
      })
      .filter((l): l is StoredLine => l !== null && l.quantity > 0);
  } catch {
    return [];
  }
}

const clampToStock = (sku: string, quantity: number) => {
  const found = getBySku(sku);
  return found ? Math.max(0, Math.min(quantity, found.variant.stock)) : 0;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredLine[]>(loadStoredLines);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage can be unavailable (private windows). The cart still works in memory.
    }
  }, [stored]);

  const add = useCallback((sku: string, quantity = 1) => {
    setStored((prev) => {
      const existing = prev.find((l) => l.sku === sku);
      const next = clampToStock(sku, (existing?.quantity ?? 0) + quantity);
      if (next === 0) return prev;
      return existing ? prev.map((l) => (l.sku === sku ? { ...l, quantity: next } : l)) : [...prev, { sku, quantity: next }];
    });
  }, []);

  const setQuantity = useCallback((sku: string, quantity: number) => {
    setStored((prev) => {
      const next = clampToStock(sku, quantity);
      return next === 0 ? prev.filter((l) => l.sku !== sku) : prev.map((l) => (l.sku === sku ? { ...l, quantity: next } : l));
    });
  }, []);

  const remove = useCallback((sku: string) => setStored((prev) => prev.filter((l) => l.sku !== sku)), []);
  const clear = useCallback(() => setStored([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => {
    const lines: CartLine[] = stored.flatMap((l) => {
      const found = getBySku(l.sku);
      return found ? [{ sku: l.sku, quantity: l.quantity, product: found.product, variant: found.variant }] : [];
    });
    const count = lines.reduce((sum, l) => sum + l.quantity, 0);
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.product.price, 0);
    return { lines, count, subtotal, isOpen, openCart, closeCart, add, setQuantity, remove, clear };
  }, [stored, isOpen, openCart, closeCart, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- hook co-located with its provider
export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
