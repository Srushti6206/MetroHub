import type { Cat, Offer, Order, Persisted, Product, Shop, Station } from '../types';
import { STATIONS } from './stations';
export { STATIONS } from './stations';
export { LINE_INFO } from './stations';

const S = 'district-court';

export const SHOPS: Shop[] = [
  { id: 'chai-tapri', name: 'Tapri Express', category: 'chai', desc: 'Kadak chai, filter coffee and quick tea-time bites.', stationId: S, zone: 'concourse', hue: ['#8b5cf6', '#f59e0b'], icon: 'coffee', kind: 'demo' },
  { id: 'vada-junction', name: 'Vada Pav Junction', category: 'bites', desc: 'Hot vada pav, bhajiya and sandwiches made to order.', stationId: S, zone: 'concourse', hue: ['#f97316', '#ef4444'], icon: 'sandwich', kind: 'demo' },
  { id: 'misal-ghar', name: 'Kasba Misal Ghar', category: 'meals', desc: 'Spicy Puneri misal pav, thalipeeth and sabudana khichdi.', stationId: S, zone: 'nearby', hue: ['#ef4444', '#f59e0b'], icon: 'utensils', kind: 'demo' },
  { id: 'tiffin-tales', name: 'Tiffin Tales', category: 'meals', desc: 'Poha, upma and light home-style meals for the morning rush.', stationId: S, zone: 'nearby', hue: ['#22c55e', '#06b6d4'], icon: 'utensils', kind: 'demo' },
  { id: 'baker-basket', name: "Baker's Basket", category: 'bakery', desc: 'Fresh buns, khari, cookies and eggless pastries.', stationId: S, zone: 'concourse', hue: ['#ec4899', '#f59e0b'], icon: 'croissant', kind: 'demo' },
  { id: 'metro-mart', name: 'Metro Mart Express', category: 'store', desc: 'Packaged snacks, juices and grab-and-go convenience items.', stationId: S, zone: 'concourse', hue: ['#6558E8', '#57D9F0'], icon: 'store', kind: 'demo' },
  { id: 'daily-needs', name: 'Daily Needs Corner', category: 'essentials', desc: 'Water, tissues, chargers and small daily essentials.', stationId: S, zone: 'nearby', hue: ['#0ea5e9', '#6558E8'], icon: 'basket', kind: 'demo' },
];

const p = (shopId: string, id: string, name: string, desc: string, price: number, category: Cat, veg: boolean, prepMin: number, available = true): Product =>
  ({ id: `${shopId}-${id}`, shopId, name, desc, price, category, veg, prepMin, available });

export const PRODUCTS: Product[] = [
  p('chai-tapri', 'chai', 'Masala Chai', 'Kadak ginger-cardamom chai in a kulhad.', 15, 'chai', true, 3),
  p('chai-tapri', 'coffee', 'Filter Coffee', 'Strong South-style filter coffee.', 39, 'chai', true, 4),
  p('chai-tapri', 'cold', 'Iced Coffee', 'Chilled coffee with a hint of caramel.', 79, 'chai', true, 5),
  p('chai-tapri', 'bun', 'Bun Maska', 'Soft bun with butter, perfect with chai.', 29, 'bakery', true, 2),
  p('chai-tapri', 'khari', 'Khari Biscuit Pack', 'Flaky khari biscuits, 6 pieces.', 39, 'snacks', true, 1),
  p('chai-tapri', 'omelette', 'Egg Bun Omelette', 'Masala omelette in a toasted bun.', 59, 'bites', false, 8),
  p('chai-tapri', 'lemon', 'Lemon Tea', 'Light lemon tea, no milk.', 25, 'chai', true, 3, false),

  p('vada-junction', 'vp', 'Vada Pav', 'Classic batata vada with garlic chutney.', 20, 'bites', true, 4),
  p('vada-junction', 'dvp', 'Cheese Vada Pav', 'Vada pav with a melty cheese slice.', 39, 'bites', true, 6),
  p('vada-junction', 'bhaji', 'Kanda Bhaji Plate', 'Crispy onion fritters with chutney.', 49, 'bites', true, 7),
  p('vada-junction', 'sand', 'Veg Grilled Sandwich', 'Grilled sandwich with veggies and green chutney.', 59, 'bites', true, 8),
  p('vada-junction', 'cs', 'Cheese Corn Sandwich', 'Sweet corn and cheese, grilled.', 89, 'bites', true, 9),
  p('vada-junction', 'combo', 'Vada Pav + Chai Combo', '2 vada pav and a masala chai.', 59, 'bites', true, 6),
  p('vada-junction', 'chicken', 'Chicken Roll', 'Spiced chicken wrapped in a paratha.', 99, 'bites', false, 12),

  p('misal-ghar', 'misal', 'Puneri Misal Pav', 'Sprouted moth curry, farsan, 2 pav.', 89, 'meals', true, 8),
  p('misal-ghar', 'thali', 'Thalipeeth with Curd', 'Multigrain thalipeeth, white butter and curd.', 79, 'meals', true, 10),
  p('misal-ghar', 'sabu', 'Sabudana Khichdi', 'Peanut-rich khichdi with a squeeze of lemon.', 59, 'meals', true, 7),
  p('misal-ghar', 'usal', 'Usal Pav', 'Mild usal with 2 pav.', 69, 'meals', true, 6),
  p('misal-ghar', 'full', 'Full Misal Thali', 'Misal, papad, kanda and solkadhi.', 129, 'meals', true, 12),
  p('misal-ghar', 'sol', 'Solkadhi', 'Cooling kokum-coconut drink.', 39, 'chai', true, 2),
  p('misal-ghar', 'puran', 'Puran Poli', 'Sweet puran poli with ghee.', 49, 'bakery', true, 6, false),

  p('tiffin-tales', 'poha', 'Kanda Poha', 'Light poha with peanuts and lemon.', 39, 'meals', true, 5),
  p('tiffin-tales', 'upma', 'Rava Upma', 'Soft upma with curry leaves.', 39, 'meals', true, 5),
  p('tiffin-tales', 'idli', 'Idli Sambar (3 pcs)', 'Steamed idlis with sambar and chutney.', 59, 'meals', true, 8),
  p('tiffin-tales', 'dosa', 'Masala Dosa', 'Crisp dosa with potato masala.', 89, 'meals', true, 10),
  p('tiffin-tales', 'curdrice', 'Curd Rice Bowl', 'Cooling curd rice with pomegranate.', 69, 'meals', true, 5),
  p('tiffin-tales', 'thali', 'Mini Veg Thali', 'Roti, sabzi, dal, rice.', 129, 'meals', true, 14),
  p('tiffin-tales', 'egg', 'Egg Bhurji Pav', 'Spicy bhurji with buttered pav.', 79, 'meals', false, 9),

  p('baker-basket', 'khari', 'Butter Khari (6 pcs)', 'Flaky khari baked in butter.', 49, 'bakery', true, 1),
  p('baker-basket', 'cookie', 'Choco Chip Cookie', 'Eggless choco chip cookie.', 39, 'bakery', true, 1),
  p('baker-basket', 'pastry', 'Pineapple Pastry', 'Eggless pineapple pastry slice.', 59, 'bakery', true, 2),
  p('baker-basket', 'cake', 'Brownie Slice', 'Fudgy chocolate brownie.', 89, 'bakery', true, 3),
  p('baker-basket', 'puff', 'Veg Puff', 'Flaky puff with spiced vegetable filling.', 29, 'bakery', true, 3),
  p('baker-basket', 'croiss', 'Butter Croissant', 'Buttery layered croissant.', 79, 'bakery', true, 3),
  p('baker-basket', 'cake2', 'Eggless Cake Jar', 'Chocolate cake layers in a jar.', 129, 'bakery', true, 4),
  p('baker-basket', 'bread', 'Milk Bread Loaf', 'Fresh milk bread loaf.', 45, 'bakery', true, 1, false),

  p('metro-mart', 'chips', 'Masala Chips (50g)', 'Classic masala potato chips.', 20, 'snacks', true, 1),
  p('metro-mart', 'bhujia', 'Bhakarwadi Pack', 'Pune-style bhakarwadi, 150g.', 59, 'snacks', true, 1),
  p('metro-mart', 'nuts', 'Roasted Peanut Mix', 'Spiced roasted peanuts, 100g.', 39, 'snacks', true, 1),
  p('metro-mart', 'juice', 'Mixed Fruit Juice', 'Chilled 200ml fruit juice.', 30, 'chai', true, 1),
  p('metro-mart', 'bar', 'Protein Bar', 'Nut and oats protein bar.', 99, 'snacks', true, 1),
  p('metro-mart', 'water', 'Water Bottle 1L', 'Packaged drinking water.', 20, 'essentials', true, 1),
  p('metro-mart', 'cake', 'Dry Fruit Laddoo', 'Single-serve dry fruit laddoo.', 49, 'snacks', true, 1),
  p('metro-mart', 'nood', 'Instant Cup Noodles', 'Ready in 3 minutes with hot water.', 59, 'snacks', true, 4, false),

  p('daily-needs', 'water', 'Water Bottle 500ml', 'Packaged drinking water.', 10, 'essentials', true, 1),
  p('daily-needs', 'tissue', 'Tissue Pack', 'Pocket tissues, 10 sheets.', 15, 'essentials', true, 1),
  p('daily-needs', 'sani', 'Hand Sanitizer 50ml', 'Travel-size hand sanitizer.', 39, 'essentials', true, 1),
  p('daily-needs', 'cable', 'USB-C Charging Cable', 'Basic 1 m charging cable.', 199, 'essentials', true, 2),
  p('daily-needs', 'umb', 'Pocket Umbrella', 'Compact folding umbrella.', 199, 'essentials', true, 2),
  p('daily-needs', 'mask', 'Face Mask (3 pcs)', 'Disposable masks.', 29, 'essentials', true, 1),
  p('daily-needs', 'pen', 'Gel Pen + Notepad', 'Pocket notepad and a gel pen.', 49, 'essentials', true, 1),
];

export const OFFERS: Offer[] = [
  { id: 'o1', shopId: 'chai-tapri', title: '10% off on orders above ₹59', percent: 10, minSubtotal: 59, active: true },
  { id: 'o2', shopId: 'vada-junction', title: '15% off on orders above ₹99', percent: 15, minSubtotal: 99, active: true },
  { id: 'o3', shopId: 'misal-ghar', title: '10% off on orders above ₹129', percent: 10, minSubtotal: 129, active: true },
  { id: 'o4', shopId: 'baker-basket', title: '12% off on orders above ₹99', percent: 12, minSubtotal: 99, active: true },
  { id: 'o5', shopId: 'tiffin-tales', title: '8% off on orders above ₹99', percent: 8, minSubtotal: 99, active: true },
  { id: 'o6', shopId: 'metro-mart', title: '10% off on orders above ₹149', percent: 10, minSubtotal: 149, active: true },
];

function mins(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function seedOrders(): Order[] {
  const now = mins();
  const mk = (id: string, shopId: string, shopName: string, items: [string, string, number, number][], status: Order['status'], offsetArrive: number): Order => {
    const subtotal = items.reduce((a, i) => a + i[2] * i[3], 0);
    const hist: Order['history'] = [{ status: 'placed', at: Date.now() - 15 * 60000 }];
    if (status !== 'placed') hist.push({ status, at: Date.now() - 5 * 60000 });
    return {
      id, shopId, shopName,
      items: items.map(([productId, name, price, qty]) => ({ productId, name, price, qty })),
      subtotal, discount: 0, total: subtotal,
      stationId: S, pickupPoint: 'District Court — demo pickup point (simulated)',
      arrival: Math.min(1439, now + offsetArrive), pickup: Math.min(1439, now + offsetArrive + 5),
      note: '', status, createdAt: Date.now() - 15 * 60000, history: hist, seeded: true,
    };
  };
  return [
    mk('PMH-DEMO01', 'vada-junction', 'Vada Pav Junction', [['vada-junction-vp', 'Vada Pav', 20, 2], ['vada-junction-dvp', 'Cheese Vada Pav', 39, 1]], 'placed', 15),
    mk('PMH-DEMO02', 'misal-ghar', 'Kasba Misal Ghar', [['misal-ghar-misal', 'Puneri Misal Pav', 89, 1]], 'preparing', 10),
    mk('PMH-DEMO03', 'chai-tapri', 'Tapri Express', [['chai-tapri-chai', 'Masala Chai', 15, 2], ['chai-tapri-bun', 'Bun Maska', 29, 2]], 'ready', 5),
    mk('PMH-DEMO04', 'baker-basket', "Baker's Basket", [['baker-basket-cookie', 'Choco Chip Cookie', 39, 2]], 'collected', -20),
  ];
}

export function seed(): Persisted {
  return {
    shops: SHOPS.map((s) => ({ ...s })),
    products: PRODUCTS.map((x) => ({ ...x })),
    offers: OFFERS.map((x) => ({ ...x })),
    orders: seedOrders(),
    cart: [],
    lang: 'en',
    stationId: S,
    ownerShopId: 'vada-junction',
    prefs: { veg: false, budget: 150 },
  };
}
