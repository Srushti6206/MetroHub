# Pune Metro Hub — hackathon prototype

Independent demo. **Not** an official Pune Metro / Maha Metro app. All shops, menus, prices, offers, orders and pickup windows are fictional demo data.

## Run
```
npm install
npm run dev       # development
npm run build     # type-check + build to dist/index.html (single file, opens by double-click)
```

## What works
- Routes: `/`, `/stations`, `/shops`, `/shops/:id`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/owner`, `/owner/products`, `/owner/orders` (hash routing)
- 7 fictional demo shops, ~50 products, offers, seeded orders in different statuses
- Cart (shop-wise groups, offer discounts, availability validation), checkout with arrival/pickup validation against prep time
- Order tracking with simulated status advance; owner dashboard changes status and the customer view updates
- Owner: add/edit/delete products, availability, prep time, offers
- MetroMate AI: rule-based recommender (AI Demo Mode) — budget, minutes, veg filter, availability, cart-aware, add-to-cart
- English / हिंदी / मराठी UI translation (product and shop names stay in English)
- State persisted in localStorage (`pune-metro-hub-v1`)

## Not implemented (do not claim)
Flask/SQLite backend, live train data, real payments, real inventory, any LLM. Shop images are generated gradient covers, not photography.

## Accuracy note
District Court (Civil Court) as a Purple (Line 1) / Aqua (Line 2) interchange was confirmed from public secondary sources. punemetrorail.org could not be fetched during the build — re-verify before presenting it as official.

## Structure
`src/data/seed.ts` (single catalog) · `src/store.tsx` (state + persistence) · `src/lib/metromate.ts` (recommender) · `src/lib/cart.ts` · `src/i18n.ts` · `src/pages/*` · `src/components/*`
