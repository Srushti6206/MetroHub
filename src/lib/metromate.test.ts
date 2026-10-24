import { describe, expect, it } from 'vitest';
import { PRODUCTS, SHOPS, seed } from '../data/seed';
import { hydratePersistedState } from '../store';
import { parseQuery, recommend } from './metromate';

const eggBun = PRODUCTS.find((product) => product.id === 'chai-tapri-omelette')!;

function recommendFor(message: string, veg: boolean) {
  const query = parseQuery(message, { budget: 150, veg });
  return recommend(query, {
    stationId: 'district-court', shops: SHOPS, products: PRODUCTS, cart: [], now: 600,
  });
}

describe('MetroMate vegetarian eligibility', () => {
  it('excludes Egg Bun Omelette when vegetarian mode is on', () => {
    const result = recommendFor('snacks under 100', true);
    expect(result.ok).toBe(true);
    expect(result.items).not.toContainEqual(expect.objectContaining({ id: eggBun.id }));
    expect(result.items.every((product) => product.veg)).toBe(true);
  });

  it('applies a vegetarian request in the message even when the saved toggle is off', () => {
    const query = parseQuery('suggest vegetarian snacks under 100', { budget: 150, veg: false });
    const result = recommend(query, {
      stationId: 'district-court', shops: SHOPS, products: PRODUCTS, cart: [], now: 600,
    });
    expect(query.vegOnly).toBe(true);
    expect(result.items).not.toContainEqual(expect.objectContaining({ id: eggBun.id }));
    expect(result.items.every((product) => product.veg)).toBe(true);
  });

  it('restores canonical product diet flags without discarding saved user state', () => {
    const saved = seed();
    saved.products = saved.products.map((product) => product.id === eggBun.id ? { ...product, veg: true } : product);
    saved.cart = [{ productId: eggBun.id, qty: 2 }];
    saved.prefs = { veg: false, budget: 100 };
    const hydrated = hydratePersistedState(JSON.stringify(saved));

    expect(hydrated.products.find((product) => product.id === eggBun.id)?.veg).toBe(false);
    expect(hydrated.cart).toEqual(saved.cart);
    expect(hydrated.prefs).toEqual(saved.prefs);
    expect(hydrated.orders).toEqual(saved.orders);

    const query = parseQuery('vegetarian snacks under 100', hydrated.prefs);
    const result = recommend(query, {
      stationId: hydrated.stationId, shops: hydrated.shops, products: hydrated.products,
      cart: hydrated.cart, now: 600,
    });
    expect(result.items).not.toContainEqual(expect.objectContaining({ id: eggBun.id }));
  });

  it('keeps non-vegetarian products eligible when vegetarian mode is off', () => {
    const result = recommendFor('snacks under 100', false);
    expect(result.ok).toBe(true);
    expect(result.items.some((product) => product.id === eggBun.id)).toBe(true);
  });
});
