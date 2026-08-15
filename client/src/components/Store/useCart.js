import { useState, useEffect, useCallback, useMemo } from 'react';

// Public store cart — persisted to localStorage so a browser reload
// doesn't wipe what a customer has been building up. Kept
// deliberately dumb: an array of { itemId, name, price, quantity,
// image } lines. Server re-verifies item + price at checkout, so
// the client copy is a UX cache, not a source of truth.
const KEY = 'fablab_store_cart';

const readInitial = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export default function useCart() {
  const [lines, setLines] = useState(readInitial);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {}
  }, [lines]);

  // Sync across tabs so opening the store in another tab shows the
  // same cart state.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) {
        try { setLines(Array.isArray(JSON.parse(e.newValue)) ? JSON.parse(e.newValue) : []); }
        catch { setLines([]); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((item, qty = 1) => {
    setLines(prev => {
      const idx = prev.findIndex(l => l.itemId === item.itemId);
      if (idx === -1) {
        return [...prev, {
          itemId: item.itemId,
          name: item.name,
          nameEn: item.nameEn || null,
          price: Number(item.price) || 0,
          quantity: Math.max(1, qty),
          image: (Array.isArray(item.images) && item.images[0]) || null,
          maxStock: item.stock
        }];
      }
      const next = [...prev];
      const cap = next[idx].maxStock;
      const nextQty = next[idx].quantity + qty;
      next[idx] = { ...next[idx], quantity: cap >= 0 ? Math.min(cap, nextQty) : nextQty };
      return next;
    });
  }, []);

  const setQuantity = useCallback((itemId, qty) => {
    setLines(prev => prev.map(l => {
      if (l.itemId !== itemId) return l;
      const cap = l.maxStock;
      const q = Math.max(1, Math.floor(qty));
      return { ...l, quantity: cap >= 0 ? Math.min(cap, q) : q };
    }));
  }, []);

  const remove = useCallback((itemId) => {
    setLines(prev => prev.filter(l => l.itemId !== itemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(
    () => +lines.reduce((s, l) => s + (Number(l.price) || 0) * l.quantity, 0).toFixed(2),
    [lines]
  );
  const count = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  return { lines, add, setQuantity, remove, clear, subtotal, count };
}
