"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CartItem, Product } from "./types";

const CART_KEY = "miguelon-cart";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrationTask = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(CART_KEY);
        if (saved) setItems(JSON.parse(saved) as CartItem[]);
      } catch {
        window.localStorage.removeItem(CART_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const add = useCallback((product: Product, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...current, { product, quantity }];
    });
  }, []);

  const update = useCallback((productId: string, quantity: number) => {
    setItems((current) =>
      quantity < 1
        ? current.filter((item) => item.product.id !== productId)
        : current.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item,
          ),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.product.id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.product.precio * item.quantity,
        0,
      ),
    [items],
  );

  return { items, add, update, remove, clear, count, subtotal };
}
