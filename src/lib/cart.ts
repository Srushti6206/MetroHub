import type { CartLine, Offer, Product, Shop } from '../types';

export interface CartLineView { product: Product; qty: number; ok: boolean }
export interface CartGroup {
  shop: Shop;
  lines: CartLineView[];
  subtotal: number;
  offer?: Offer;
  discount: number;
  total: number;
  maxPrep: number;
  hasUnavailable: boolean;
  /** amount still needed to unlock the best inactive-threshold offer */
  nextOfferGap?: number;
  nextOffer?: Offer;
}

export function bestOffer(offers: Offer[], shopId: string, subtotal: number): Offer | undefined {
  return offers
    .filter((o) => o.shopId === shopId && o.active && subtotal >= o.minSubtotal)
    .sort((a, b) => b.percent - a.percent)[0];
}

export function groupCart(cart: CartLine[], products: Product[], shops: Shop[], offers: Offer[]): CartGroup[] {
  const byShop = new Map<string, CartLineView[]>();
  for (const l of cart) {
    const product = products.find((p) => p.id === l.productId);
    if (!product) continue;
    const arr = byShop.get(product.shopId) ?? [];
    arr.push({ product, qty: l.qty, ok: product.available });
    byShop.set(product.shopId, arr);
  }
  const groups: CartGroup[] = [];
  byShop.forEach((lines, shopId) => {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    const subtotal = lines.filter((l) => l.ok).reduce((a, l) => a + l.product.price * l.qty, 0);
    const offer = bestOffer(offers, shopId, subtotal);
    const discount = offer ? Math.round((subtotal * offer.percent) / 100) : 0;
    const locked = offers
      .filter((o) => o.shopId === shopId && o.active && subtotal < o.minSubtotal)
      .sort((a, b) => a.minSubtotal - b.minSubtotal)[0];
    groups.push({
      shop, lines, subtotal, offer, discount,
      total: subtotal - discount,
      maxPrep: Math.max(0, ...lines.filter((l) => l.ok).map((l) => l.product.prepMin)),
      hasUnavailable: lines.some((l) => !l.ok),
      nextOffer: locked,
      nextOfferGap: locked ? locked.minSubtotal - subtotal : undefined,
    });
  });
  return groups;
}

export const cartCount = (cart: CartLine[]) => cart.reduce((a, l) => a + l.qty, 0);
