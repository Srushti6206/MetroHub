export type Lang = 'en' | 'hi' | 'mr';
export type Cat = 'chai' | 'bites' | 'meals' | 'bakery' | 'snacks' | 'essentials';
export type ShopCat = 'chai' | 'bites' | 'meals' | 'bakery' | 'store' | 'essentials';
export type Zone = 'concourse' | 'nearby';
export type LineCode = 'purple' | 'aqua' | 'line3';
export type StationStatus = 'operational' | 'under_construction' | 'planned' | 'requires_verification';
export type Status = 'placed' | 'accepted' | 'preparing' | 'ready' | 'collected' | 'rejected';

export interface Station {
  id: string;
  name: string;
  lines: LineCode[];
  interchange?: boolean;
  sequence: Partial<Record<LineCode, number>>;
  status: StationStatus;
  statusByLine: Partial<Record<LineCode, StationStatus>>;
  aliases?: string[];
  sourceUrl?: string;
  sourceUrls?: string[];
  statusNote?: string;
  hasDemoShops: boolean;
}

export interface Shop {
  id: string;
  name: string;
  category: ShopCat;
  desc: string;
  stationId: string;
  stationIds?: string[];
  /** Approximate, demo-only placement. NOT a real location. */
  zone: Zone;
  hue: [string, string];
  icon: string;
  kind: 'demo' | 'verified';
  locationType?: 'inside_station' | 'station_premises' | 'nearby_outside' | 'demo_unverified';
  distanceMetres?: number;
  address?: string;
  openingHours?: string;
  verificationStatus?: 'sample' | 'verified' | 'unverified';
  dataSource?: string;
  lastVerifiedAt?: string | null;
}

export interface Product {
  id: string;
  /** Stable catalog key supplied by Flask; used to migrate old local IDs and choose featured seed items. */
  seedKey?: string;
  shopId: string;
  name: string;
  desc: string;
  price: number;
  category: Cat;
  veg: boolean;
  available: boolean;
  prepMin: number;
}

export interface Offer {
  id: string;
  shopId: string;
  title: string;
  percent: number;
  minSubtotal: number;
  active: boolean;
}

export interface CartLine { productId: string; qty: number }

export interface OrderItem { productId: string; name: string; price: number; qty: number }

export interface Order {
  id: string;
  shopId: string;
  shopName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  offerTitle?: string;
  total: number;
  stationId: string;
  pickupPoint: string;
  arrival: number; // minutes since midnight
  pickup: number;
  note: string;
  status: Status;
  createdAt: number;
  history: { status: Status; at: number }[];
  seeded?: boolean;
}

export interface Persisted {
  shops: Shop[];
  products: Product[];
  offers: Offer[];
  orders: Order[];
  cart: CartLine[];
  lang: Lang;
  stationId: string;
  ownerShopId: string;
  prefs: { veg: boolean; budget: number };
}
