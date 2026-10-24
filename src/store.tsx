import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Offer, Order, Persisted, Product, Station, Status } from './types';
import { seed } from './data/seed';
import { tr } from './i18n';
import { groupCart, cartCount, type CartGroup } from './lib/cart';
import { api, ApiError } from './api/client';

const KEY = 'pune-metro-hub-v1';

/** Merge saved user state onto the current seed, while keeping known product diet flags canonical. */
export function hydratePersistedState(raw: string | null): Persisted {
  const defaults = seed();
  if (!raw) return defaults;
  try {
    const saved = JSON.parse(raw) as Partial<Persisted>;
    const canonicalVeg = new Map(defaults.products.map((product) => [product.id, product.veg]));
    const products = Array.isArray(saved.products)
      ? saved.products.map((product) => ({
        ...product,
        veg: canonicalVeg.has(product.id) ? canonicalVeg.get(product.id)! : product.veg,
      }))
      : defaults.products;
    return { ...defaults, ...saved, products };
  } catch { /* ignore corrupt storage */ }
  return defaults;
}

function load(): Persisted {
  try {
    return hydratePersistedState(localStorage.getItem(KEY));
  } catch { /* localStorage can be unavailable */ }
  return seed();
}

export const FLOW: Status[] = ['placed', 'accepted', 'preparing', 'ready', 'collected'];

interface Toast { id: number; msg: string }

interface Ctx extends Persisted {
  stations: Station[];
  catalogStatus: 'loading' | 'ready' | 'error';
  backendError: string;
  reloadBackend: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  groups: CartGroup[];
  count: number;
  toasts: Toast[];
  mateOpen: boolean;
  setMateOpen: (v: boolean) => void;
  toast: (msg: string) => void;
  setLang: (l: Lang) => void;
  setStation: (id: string) => void;
  setOwnerShop: (id: string) => void;
  setPrefs: (p: Partial<Persisted['prefs']>) => void;
  addToCart: (productId: string, qty?: number) => void;
  addMany: (productIds: string[]) => void;
  setQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  placeOrders: (info: { arrival: number; pickup: number; note: string }) => Promise<Order[]>;
  setOrderStatus: (id: string, status: Status) => Promise<boolean>;
  advanceOrder: (id: string) => Promise<boolean>;
  saveProduct: (p: Product) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  saveOffer: (o: Offer) => Promise<boolean>;
  deleteOffer: (id: string) => Promise<boolean>;
  resetDemo: () => void;
}

const C = createContext<Ctx | null>(null);
export const useStore = () => {
  const v = useContext(C);
  if (!v) throw new Error('StoreProvider missing');
  return v;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Persisted>(load);
  const [stations, setStations] = useState<Station[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<Ctx['catalogStatus']>('loading');
  const [backendError, setBackendError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mateOpen, setMateOpen] = useState(false);

  const reloadBackend = useCallback(async () => {
    setCatalogStatus('loading');
    setBackendError('');
    try {
      const data = await api.loadAll();
      setStations(data.stations);
      setS((st) => {
        const stationId = data.stations.some((x) => x.id === st.stationId)
          ? st.stationId : data.stationIdsBySeedKey[st.stationId] ?? data.stations[0]?.id ?? '';
        const ownerShopId = data.shops.some((x) => x.id === st.ownerShopId)
          ? st.ownerShopId : data.shopIdsBySeedKey[st.ownerShopId] ?? data.shops[0]?.id ?? '';
        return {
          ...st,
          shops: data.shops,
          products: data.products,
          offers: data.offers,
          orders: data.orders,
          stationId,
          ownerShopId,
          cart: st.cart.map((line) => ({
            ...line, productId: data.productIdsBySeedKey[line.productId] ?? line.productId,
          })),
        } as Persisted;
      });
      setCatalogStatus('ready');
    } catch (e) {
      setBackendError(e instanceof Error ? e.message : 'Could not load catalog from the backend.');
      setCatalogStatus('error');
    }
  }, []);

  useEffect(() => { void reloadBackend(); }, [reloadBackend]);

  const showApiError = useCallback((e: unknown) => {
    setBackendError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'The backend request failed.');
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full/blocked */ }
  }, [s]);

  useEffect(() => { document.documentElement.lang = s.lang; }, [s.lang]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => tr(s.lang, key, vars), [s.lang]);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, msg }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 2600);
  }, []);

  const groups = useMemo(() => groupCart(s.cart, s.products, s.shops, s.offers), [s.cart, s.products, s.shops, s.offers]);

  const addToCart = useCallback((productId: string, qty = 1) => {
    setS((st) => {
      const prod = st.products.find((p) => p.id === productId);
      if (!prod || !prod.available) return st;
      const ex = st.cart.find((l) => l.productId === productId);
      const cart = ex
        ? st.cart.map((l) => (l.productId === productId ? { ...l, qty: Math.min(20, l.qty + qty) } : l))
        : [...st.cart, { productId, qty }];
      return { ...st, cart };
    });
  }, []);

  const value: Ctx = {
    ...s,
    stations, catalogStatus, backendError, reloadBackend,
    t, groups, count: cartCount(s.cart), toasts, mateOpen, setMateOpen, toast,
    setLang: (lang) => setS((st) => ({ ...st, lang })),
    setStation: (stationId) => setS((st) => ({ ...st, stationId })),
    setOwnerShop: (ownerShopId) => setS((st) => ({ ...st, ownerShopId })),
    setPrefs: (p) => setS((st) => ({ ...st, prefs: { ...st.prefs, ...p } })),
    addToCart,
    addMany: (ids) => ids.forEach((id) => addToCart(id, 1)),
    setQty: (productId, qty) =>
      setS((st) => ({
        ...st,
        cart: qty <= 0 ? st.cart.filter((l) => l.productId !== productId) : st.cart.map((l) => (l.productId === productId ? { ...l, qty: Math.min(20, qty) } : l)),
      })),
    removeFromCart: (productId) => setS((st) => ({ ...st, cart: st.cart.filter((l) => l.productId !== productId) })),
    clearCart: () => setS((st) => ({ ...st, cart: [] })),

    placeOrders: async ({ arrival, pickup, note }) => {
      const snapshot = s;
      const created: Order[] = [];
      for (const group of groupCart(snapshot.cart, snapshot.products, snapshot.shops, snapshot.offers)) {
        try {
          const order = await api.createOrder({
            stationId: snapshot.stationId, shopId: group.shop.id,
            items: group.lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
            arrival, pickup, note,
          }, snapshot.shops);
          created.push(order);
          const purchased = new Set(group.lines.map((line) => line.product.id));
          setS((st) => ({ ...st, orders: [order, ...st.orders], cart: st.cart.filter((line) => !purchased.has(line.productId)) }));
          setBackendError('');
        } catch (e) {
          showApiError(e);
          throw e;
        }
      }
      return created;
    },

    setOrderStatus: async (id, status) => {
      const order = s.orders.find((o) => o.id === id);
      if (!order) return false;
      try {
        const updated = await api.ownerStatus(order.shopId, id, status, s.shops);
        setS((st) => ({ ...st, orders: st.orders.map((o) => o.id === id ? updated : o) }));
        setBackendError('');
        return true;
      } catch (e) { showApiError(e); return false; }
    },
    advanceOrder: async (id) => {
      const order = s.orders.find((o) => o.id === id);
      const i = order ? FLOW.indexOf(order.status) : -1;
      if (!order || i < 0 || i >= FLOW.length - 1) return false;
      try {
        const updated = await api.customerStatus(id, FLOW[i + 1], s.shops);
        setS((st) => ({ ...st, orders: st.orders.map((o) => o.id === id ? updated : o) }));
        setBackendError('');
        return true;
      } catch (e) { showApiError(e); return false; }
    },

    saveProduct: async (p) => {
      const exists = s.products.some((x) => x.id === p.id);
      try {
        const saved = await api.saveProduct(p.shopId, p, exists);
        setS((st) => ({ ...st, products: exists
          ? st.products.map((x) => x.id === p.id ? saved : x)
          : [...st.products, saved] }));
        setBackendError('');
        return true;
      } catch (e) { showApiError(e); return false; }
    },
    deleteProduct: async (id) => {
      const product = s.products.find((p) => p.id === id);
      if (!product) return false;
      try {
        await api.deleteProduct(product.shopId, id);
        setS((st) => ({ ...st, products: st.products.filter((p) => p.id !== id), cart: st.cart.filter((l) => l.productId !== id) }));
        setBackendError('');
        return true;
      } catch (e) { showApiError(e); return false; }
    },
    saveOffer: async (o) => {
      const exists = s.offers.some((x) => x.id === o.id);
      try {
        const saved = await api.saveOffer(o.shopId, o, exists);
        setS((st) => ({ ...st, offers: exists
          ? st.offers.map((x) => x.id === o.id ? saved : x)
          : [...st.offers, saved] }));
        setBackendError('');
        return true;
      } catch (e) { showApiError(e); return false; }
    },
    deleteOffer: async (id) => {
      const offer = s.offers.find((o) => o.id === id);
      if (!offer) return false;
      try {
        await api.deleteOffer(offer.shopId, id);
        setS((st) => ({ ...st, offers: st.offers.filter((o) => o.id !== id) }));
        setBackendError('');
        return true;
      } catch (e) { showApiError(e); return false; }
    },
    resetDemo: () => setS((st) => ({ ...st, cart: [], lang: st.lang, prefs: { veg: false, budget: 150 } })),
  };

  return <C.Provider value={value}>{children}</C.Provider>;
}
