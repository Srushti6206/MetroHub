// Exports the frontend demo catalog (src/data/seed.ts) to backend/data/catalog.json.
// Run: npx tsx scripts/export-seed.ts
import { writeFileSync } from 'node:fs';
import { STATIONS, SHOPS, PRODUCTS, OFFERS } from '../src/data/seed';
writeFileSync('backend/data/catalog.json', JSON.stringify({ stations: STATIONS, shops: SHOPS, products: PRODUCTS, offers: OFFERS }, null, 2));
console.log('catalog.json written:', SHOPS.length, 'shops,', PRODUCTS.length, 'products,', OFFERS.length, 'offers');
