/** API client: the only module that talks to Flask. Maps API (paise, ISO dates, snake_case) to existing UI types. */
import type { LineCode, Offer, Order, Product, Shop, Station, StationStatus, Status } from '../types';

export const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:5000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function req<T>(path: string, opts: { method?: string; body?: unknown; ownerShop?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.ownerShop) headers['X-Demo-Owner-Shop'] = opts.ownerShop;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { method: opts.method ?? 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, 'unreachable', `Cannot reach the backend at ${API_BASE}. Start MongoDB and Flask (see backend/README.md).`);
  }
  if (res.status === 204) return undefined as T;
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

// ---- mappers ----
const station = (r: any): Station => ({
  id: r.id, name: r.display_name, lines: (r.lines ?? []).map((l: any) => l.code as LineCode), interchange: !!r.is_interchange,
  sequence: r.sequence ?? {}, status: (r.status ?? 'requires_verification') as StationStatus,
  statusByLine: r.status_by_line ?? {}, aliases: r.aliases ?? [], sourceUrl: r.source_urls?.[0], sourceUrls: r.source_urls ?? [],
  statusNote: r.status_note, hasDemoShops: !!r.has_demo_shops,
});
const shop = (r: any): Shop => ({
  id: r.id, name: r.name, category: r.category, desc: r.description,
  stationIds: r.station_ids ?? (r.station_id ? [r.station_id] : []), stationId: r.station_ids?.[0] ?? r.station_id ?? '', zone: r.zone ?? 'nearby',
  hue: r.ui?.hue ?? ['#6558E8', '#57D9F0'], icon: r.ui?.icon ?? 'store', kind: r.shop_type,
  locationType: r.location_type, distanceMetres: r.distance_metres, address: r.address,
  openingHours: r.opening_hours, verificationStatus: r.verification_status, dataSource: r.data_source,
  lastVerifiedAt: r.last_verified_at,
});
const product = (r: any): Product => ({
  id: r.id, seedKey: r.seed_key, shopId: r.shop_id, name: r.name, desc: r.description, price: r.price_paise / 100,
  category: r.category, veg: r.is_vegetarian, available: r.is_available, prepMin: r.preparation_minutes,
});
const offer = (r: any): Offer => ({
  id: r.id, shopId: r.shop_id, title: r.title, percent: r.discount_type === 'percent' ? r.discount_value : 0,
  minSubtotal: (r.min_subtotal_paise ?? 0) / 100, active: !!r.is_live,
});
const LEGACY_STATION_SEED_KEYS: Record<string, string> = { deccan: 'deccan-gymkhana', 'pune-rly': 'pune-railway-station' };
export function mapStationSeedKeys(rows: { seed_key: string; id: string }[]): Record<string, string> {
  const ids = Object.fromEntries(rows.map((row) => [row.seed_key, row.id]));
  for (const [legacy, canonical] of Object.entries(LEGACY_STATION_SEED_KEYS)) if (ids[canonical]) ids[legacy] = ids[canonical];
  return ids;
}
const minutesOfDay = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
export const minutesToIso = (m: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setMinutes(m); return d.toISOString(); };

export const mapOrder = (r: any, shops: Shop[]): Order => ({
  id: r.order_number, shopId: r.shop_id, shopName: shops.find((s) => s.id === r.shop_id)?.name ?? 'Shop',
  items: r.items.map((i: any) => ({ productId: i.product_id, name: i.product_name, price: i.unit_price_paise / 100, qty: i.quantity })),
  subtotal: r.subtotal_paise / 100, discount: r.discount_paise / 100, offerTitle: r.offer_title ?? undefined, total: r.total_paise / 100,
  stationId: r.station_id, pickupPoint: 'District Court — demo pickup point (simulated)',
  arrival: minutesOfDay(r.expected_arrival_at), pickup: minutesOfDay(r.preferred_pickup_at), note: r.customer_notes ?? '',
  status: r.status as Status, createdAt: Date.parse(r.created_at),
  history: (r.status_history ?? []).map((h: any) => ({ status: h.status as Status, at: Date.parse(h.at) })), seeded: !!r.is_demo_seed,
});

export interface ChatRec {
  product_id: string; product_name: string; price_paise: number; shop_id: string; shop_name: string;
  is_available: boolean; is_vegetarian: boolean; preparation_minutes: number; reason: string;
  station_locations: { station_id: string; station_name: string; lines: { code: string; name: string; line_number: number }[];
    status_by_line: Record<string, string>; location_type: string; distance_metres?: number | null; verification_status: string;
    price_paise: number; shop_name: string; shop_id: string; detail_path: string }[];
  shop_type: string; verification_status: string; data_source: string; detail_path: string;
}
export interface ChatResponse {
  reply: string; recommendations: ChatRec[]; total_paise: number; reasons: string[]; earliest_ready_at: string | null;
  pickup_estimate_note: string; suggested_prompts: string[]; mode: 'llm' | 'rule_based'; fallback_note: string | null;
  suggestions: { items: ChatRec[]; total_paise: number; reasons: string[]; earliest_ready_at: string | null; shop_name: string }[];
}

export const api = {
  health: () => req<{ status: string; chat_mode: 'llm' | 'rule_based'; database: { connected: boolean } }>('/api/health'),
  async loadAll() {
    const [st, sh, pr, of, or, health] = await Promise.all([
      req<any[]>('/api/stations'), req<any[]>('/api/shops'), req<any[]>('/api/products'),
      req<any[]>('/api/offers?include_inactive=true'), req<any[]>('/api/orders'), api.health(),
    ]);
    const shops = sh.map(shop);
    return {
      stations: st.map(station), shops, products: pr.map(product), offers: of.map(offer),
      orders: or.map((o) => mapOrder(o, shops)),
<<<<<<< HEAD
      stationIdsBySeedKey: mapStationSeedKeys(st),
=======
      chatMode: health.chat_mode,
      stationIdsBySeedKey: Object.fromEntries(st.map((r: any) => [r.seed_key, r.id])) as Record<string, string>,
>>>>>>> f9dfacfc5a79c5506c80fb7cf112e72986f01ef2
      shopIdsBySeedKey: Object.fromEntries(sh.map((r: any) => [r.seed_key, r.id])) as Record<string, string>,
      productIdsBySeedKey: Object.fromEntries(pr.map((r: any) => [r.seed_key, r.id])) as Record<string, string>,
    };
  },
  async createOrder(a: { stationId: string; shopId: string; items: { productId: string; qty: number }[]; arrival: number; pickup: number; note: string }, shops: Shop[]) {
    const r = await req<any>('/api/orders', { method: 'POST', body: {
      station_id: a.stationId, shop_id: a.shopId, items: a.items.map((i) => ({ product_id: i.productId, quantity: i.qty })),
      expected_arrival_at: minutesToIso(a.arrival), preferred_pickup_at: minutesToIso(a.pickup), customer_notes: a.note,
    } });
    return mapOrder(r, shops);
  },
  async customerStatus(id: string, status: Status, shops: Shop[]) {
    return mapOrder(await req<any>(`/api/orders/${id}/status`, { method: 'PATCH', body: { status } }), shops);
  },
  async ownerStatus(shopId: string, id: string, status: Status, shops: Shop[]) {
    return mapOrder(await req<any>(`/api/owner/orders/${id}/status`, { method: 'PATCH', body: { status }, ownerShop: shopId }), shops);
  },
  async saveProduct(shopId: string, p: Product, exists: boolean) {
    const body = { name: p.name, description: p.desc, category: p.category, price_paise: Math.round(p.price * 100),
      preparation_minutes: p.prepMin, is_vegetarian: p.veg, is_available: p.available };
    const saved = await (exists
      ? req<any>(`/api/owner/products/${p.id}`, { method: 'PATCH', body, ownerShop: shopId })
      : req<any>('/api/owner/products', { method: 'POST', body, ownerShop: shopId }));
    return product(saved);
  },
  deleteProduct: (shopId: string, id: string) => req<void>(`/api/owner/products/${id}`, { method: 'DELETE', ownerShop: shopId }),
  async saveOffer(shopId: string, o: Offer, exists: boolean) {
    const body = { title: o.title, discount_type: 'percent', discount_value: o.percent, min_subtotal_paise: Math.round(o.minSubtotal * 100), is_active: o.active };
    const saved = await (exists
      ? req<any>(`/api/owner/offers/${o.id}`, { method: 'PATCH', body, ownerShop: shopId })
      : req<any>('/api/owner/offers', { method: 'POST', body, ownerShop: shopId }));
    return offer(saved);
  },
  deleteOffer: (shopId: string, id: string) => req<void>(`/api/owner/offers/${id}`, { method: 'DELETE', ownerShop: shopId }),
  chat: (body: unknown) => req<ChatResponse>('/api/chat', { method: 'POST', body }),
};
