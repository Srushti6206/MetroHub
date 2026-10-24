/**
 * MetroMate AI — deterministic, rule-based recommender (AI Demo Mode).
 * No LLM is called. To plug in a real model later, replace `recommend()` with a
 * call that returns the same `Recommendation` shape.
 */
import type { CartLine, Product, Shop } from '../types';

export interface Query {
  budget: number;
  minutes: number;
  vegOnly: boolean;
  intent: 'chai_bite' | 'meal' | 'snacks' | 'general';
}

export interface Recommendation {
  ok: boolean;
  shop?: Shop;
  items: Product[];
  total: number;
  reasons: string[];
  pickupFrom?: number; // minutes since midnight
  pickupTo?: number;
  query: Query;
  message: string;
}

export function parseQuery(text: string, defaults: { budget: number; veg: boolean }): Query {
  const s = text.toLowerCase();
  let budget = defaults.budget;
  const b = s.match(/(?:₹|rs\.?|inr|under|below|within|budget)\s*(\d{2,4})/) || s.match(/(\d{2,4})\s*(?:₹|rs|rupees)/);
  if (b) budget = parseInt(b[1], 10);
  let minutes = 20;
  const m = s.match(/(\d{1,2})\s*(?:min|minutes|mins|मिनट|मिनिट)/);
  if (m) minutes = parseInt(m[1], 10);
  const explicitlyRequestsVegetarian = /\bvegetarian\b|\bveg\b|शाकाहारी|jain/.test(s)
    && !/\bnon[- ]?veg(?:etarian)?\b/.test(s);
  // A request in the current message must win over a saved preference, including a stale false value.
  const vegOnly = explicitlyRequestsVegetarian || defaults.veg;
  let intent: Query['intent'] = 'general';
  if (/chai|coffee|चाय|चहा/.test(s)) intent = 'chai_bite';
  else if (/meal|lunch|thali|भोजन|जेवण/.test(s)) intent = 'meal';
  else if (/snack|bite|nashta|नाश्ता/.test(s)) intent = 'snacks';
  return { budget, minutes, vegOnly, intent };
}

type Slot = { cats: Product['category'][]; optional: boolean; low?: boolean };

function slotsFor(intent: Query['intent']): Slot[] {
  switch (intent) {
    case 'chai_bite': return [{ cats: ['chai'], optional: false, low: true }, { cats: ['bites', 'bakery'], optional: false }];
    case 'meal': return [{ cats: ['meals'], optional: false }, { cats: ['chai'], optional: true, low: true }, { cats: ['bakery'], optional: true }];
    case 'snacks': return [{ cats: ['bites', 'snacks', 'bakery'], optional: false }, { cats: ['bites', 'snacks', 'bakery'], optional: true }, { cats: ['chai'], optional: true, low: true }];
    default: return [{ cats: ['meals', 'bites'], optional: false }, { cats: ['chai'], optional: true, low: true }, { cats: ['bakery', 'snacks'], optional: true }];
  }
}

function buildForShop(pool: Product[], q: Query): Product[] {
  const slots = slotsFor(q.intent);
  const used = new Set<string>();
  const out: Product[] = [];
  let remaining = q.budget;
  let failed = false;
  slots.forEach((slot, i) => {
    const cands = pool.filter((p) => slot.cats.includes(p.category) && !used.has(p.id));
    if (!cands.length) { if (!slot.optional) failed = true; return; }
    // keep room for later required slots
    const reserve = slots.slice(i + 1).filter((s) => !s.optional).reduce((a, s) => {
      const c = pool.filter((p) => s.cats.includes(p.category));
      return a + (c.length ? Math.min(...c.map((p) => p.price)) : 0);
    }, 0);
    const fit = cands.filter((p) => p.price <= remaining - reserve).sort((a, b) => (slot.low ? a.price - b.price : b.price - a.price));
    if (!fit.length) { if (!slot.optional) failed = true; return; }
    // for "snacks under X" prefer a mid-priced pick, otherwise the most substantial that fits
    const pick = fit[0];
    used.add(pick.id);
    out.push(pick);
    remaining -= pick.price;
  });
  return failed ? [] : out;
}

export function recommend(
  q: Query,
  ctx: { stationId: string; shops: Shop[]; products: Product[]; cart: CartLine[]; now: number },
): Recommendation {
  const shops = ctx.shops.filter((s) => s.stationId === ctx.stationId);
  const cartShopIds = new Set(
    ctx.cart.map((l) => ctx.products.find((p) => p.id === l.productId)?.shopId).filter(Boolean) as string[],
  );
  let best: { shop: Shop; items: Product[]; score: number } | null = null;

  for (const shop of shops) {
    const pool = ctx.products.filter((p) => {
      const containsEgg = /\begg(?!less)\b|\bomelette\b|\bbhurji\b/i.test(`${p.name} ${p.desc}`);
      return p.shopId === shop.id && p.available && p.prepMin <= q.minutes && p.price <= q.budget
        && (!q.vegOnly || (p.veg && !containsEgg));
    });
    const items = buildForShop(pool, q);
    if (!items.length) continue;
    const total = items.reduce((a, p) => a + p.price, 0);
    const score = items.length * 100 + total + (cartShopIds.has(shop.id) ? 60 : 0) - Math.max(...items.map((i) => i.prepMin));
    if (!best || score > best.score) best = { shop, items, score };
  }

  if (!best) {
    return {
      ok: false, items: [], total: 0, reasons: [], query: q,
      message: `I couldn't find available items within ₹${q.budget} and ${q.minutes} min${q.vegOnly ? ' (vegetarian)' : ''} at this station. Try a higher budget or a bit more time.`,
    };
  }

  const total = best.items.reduce((a, p) => a + p.price, 0);
  const maxPrep = Math.max(...best.items.map((p) => p.prepMin));
  const from = ctx.now + maxPrep;
  const reasons = [
    `Within your ₹${q.budget} budget — total ₹${total}.`,
    `Longest prep is ${maxPrep} min, so it fits your ${q.minutes}-minute window.`,
    q.vegOnly ? 'All items are vegetarian.' : 'Includes both veg and non-veg options where available.',
    'Only items currently marked available in the demo catalog are used.',
  ];
  if (cartShopIds.has(best.shop.id)) reasons.push('Same shop as items already in your cart, so you collect in one stop.');
  if (best.items.every((p) => p.shopId === best!.shop.id)) reasons.push(`All from ${best.shop.name} for a single pickup.`);

  return {
    ok: true, shop: best.shop, items: best.items, total, reasons, query: q,
    pickupFrom: from, pickupTo: from + 10,
    message: `Here's a ${q.vegOnly ? 'vegetarian ' : ''}pick from ${best.shop.name}:`,
  };
}
