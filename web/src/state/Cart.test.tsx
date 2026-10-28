import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/catalog';
import { CartProvider, useCart } from './Cart';

const STORAGE_KEY = 'switchback.cart.v1';
const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>;

const inStock = PRODUCTS.flatMap((p) => p.variants.map((v) => ({ p, v }))).find(({ v }) => v.stock >= 5)!;
const lowStock = PRODUCTS.flatMap((p) => p.variants.map((v) => ({ p, v }))).find(({ v }) => v.stock > 0 && v.stock <= 3)!;
const soldOut = PRODUCTS.flatMap((p) => p.variants.map((v) => ({ p, v }))).find(({ v }) => v.stock === 0)!;

describe('cart', () => {
  it('starts empty and closed', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.lines).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.isOpen).toBe(false);
  });

  it('adds by SKU, merges repeat adds, and totals the subtotal', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(inStock.v.sku));
    act(() => result.current.add(inStock.v.sku, 2));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.count).toBe(3);
    expect(result.current.subtotal).toBe(inStock.p.price * 3);
    expect(result.current.lines[0].variant.sku).toBe(inStock.v.sku);
  });

  it('never exceeds available stock', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(lowStock.v.sku, 99));
    expect(result.current.count).toBe(lowStock.v.stock);
    act(() => result.current.setQuantity(lowStock.v.sku, 99));
    expect(result.current.count).toBe(lowStock.v.stock);
  });

  it('ignores sold-out SKUs', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(soldOut.v.sku));
    expect(result.current.lines).toEqual([]);
  });

  it('removes a line when quantity drops to zero, and on remove or clear', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(inStock.v.sku, 2));
    act(() => result.current.setQuantity(inStock.v.sku, 0));
    expect(result.current.lines).toEqual([]);
    act(() => result.current.add(inStock.v.sku));
    act(() => result.current.remove(inStock.v.sku));
    expect(result.current.lines).toEqual([]);
    act(() => result.current.add(inStock.v.sku));
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it('opens and closes the drawer', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.openCart());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.closeCart());
    expect(result.current.isOpen).toBe(false);
  });

  it('persists to localStorage and restores on the next visit', () => {
    const first = renderHook(() => useCart(), { wrapper });
    act(() => first.result.current.add(inStock.v.sku, 2));
    first.unmount();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual([{ sku: inStock.v.sku, quantity: 2 }]);

    const second = renderHook(() => useCart(), { wrapper });
    expect(second.result.current.count).toBe(2);
  });

  it('drops unknown SKUs and caps stale quantities when restoring', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { sku: 'SB-NOT-A-REAL-SKU', quantity: 1 },
        { sku: lowStock.v.sku, quantity: 50 },
        { nonsense: true },
      ]),
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.lines.map((l) => l.sku)).toEqual([lowStock.v.sku]);
    expect(result.current.count).toBe(lowStock.v.stock);
  });

  it('survives corrupt storage', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.lines).toEqual([]);
  });
});
