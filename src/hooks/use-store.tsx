import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type StoredItem = {
  id: string;
  slug: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
};

type StoreCtx = {
  cart: StoredItem[];
  wishlist: StoredItem[];
  addToCart: (item: Omit<StoredItem, "quantity">, qty?: number) => void;
  removeFromCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  toggleWishlist: (item: Omit<StoredItem, "quantity">) => void;
  inWishlist: (id: string) => boolean;
  cartCount: number;
  cartTotal: number;
};

const Ctx = createContext<StoreCtx | null>(null);

const read = <T,>(k: string, fb: T): T => {
  if (typeof window === "undefined") return fb;
  try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return fb; }
};

const write = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage permission and quota issues.
  }
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<StoredItem[]>([]);
  const [wishlist, setWishlist] = useState<StoredItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(read("sig_cart", [] as StoredItem[]));
    setWishlist(read("sig_wishlist", [] as StoredItem[]));
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) write("sig_cart", cart); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) write("sig_wishlist", wishlist); }, [wishlist, hydrated]);

  const addToCart: StoreCtx["addToCart"] = useCallback((item, qty = 1) => {
    setCart((prev) => {
      const found = prev.find((p) => p.id === item.id);
      if (found) return prev.map((p) => p.id === item.id ? { ...p, quantity: p.quantity + qty } : p);
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);
  const removeFromCart = useCallback((id: string) => setCart((p) => p.filter((i) => i.id !== id)), []);
  const setQty = useCallback((id: string, qty: number) => setCart((p) => p.map((i) => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const toggleWishlist: StoreCtx["toggleWishlist"] = useCallback((item) => {
    setWishlist((prev) => prev.find((p) => p.id === item.id)
      ? prev.filter((p) => p.id !== item.id)
      : [...prev, { ...item, quantity: 1 }]);
  }, []);
  const inWishlist = useCallback((id: string) => wishlist.some((p) => p.id === id), [wishlist]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <Ctx.Provider value={{ cart, wishlist, addToCart, removeFromCart, setQty, clearCart, toggleWishlist, inWishlist, cartCount, cartTotal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}
