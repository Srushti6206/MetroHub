# Pune Metro Hub — hackathon prototype

Independent demo. **Not** an official Pune Metro / Maha Metro app. All shops, menus, prices, offers, orders and pickup windows are fictional demo data. Station names and corridors use operator/authority references; uncertain statuses are labeled.

## Run
```
npm install
npm run dev       # development
npm run build     # type-check + build to dist/index.html (single file, opens by double-click)
```

## What works
- Routes: `/`, `/stations`, `/shops`, `/shops/:id`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/owner`, `/owner/products`, `/owner/orders` (hash routing)
- Canonical Purple, Aqua, and Line 3 station discovery; Line 3 and extensions are not presented as usable unless status is verified
- Fictional demo shops/products/offers at the existing sample station, plus seeded orders in different statuses
- Cart (shop-wise groups, offer discounts, availability validation), checkout with arrival/pickup validation against prep time
- Order tracking with simulated status advance; owner dashboard changes status and the customer view updates
- Owner: add/edit/delete products, availability, prep time, offers
- MetroMate: Flask/MongoDB catalog-grounded recommendations — budget, minutes, vegetarian/egg filter, availability, cart-aware, add-to-cart and station/line/location labels
- English / हिंदी / मराठी UI translation (product and shop names stay in English)
- MongoDB-backed catalog, chat, checkout, order history/status and owner management; cart/preferences/UI state persisted in localStorage (`pune-metro-hub-v1`)

## Not implemented (do not claim)
Live train data, real payments, real inventory, verified station outlets, or a configured live LLM. MetroMate defaults to rule-based recommendations. Shop images are generated gradient covers, not photography.

## Accuracy note
Civil Court is one canonical interchange across Purple and Aqua; Line 3 also terminates there. Station source URLs and per-line status are maintained in `data/stations.json`. Verify operational status with the operator before travel; Line 3 is marked as requiring verification.

## Structure
`data/stations.json` (canonical station/status dataset) · `src/data/seed.ts` (demo catalog) · `src/store.tsx` (state + persistence) · `src/api/client.ts` · `backend/` (Flask + MongoDB) · `src/pages/*` · `src/components/*`

See [`backend/README.md`](backend/README.md) for local MongoDB/Flask setup, tests and API details. `backend/data/IMPORTING_OUTLETS.md` explains how to add source-verified outlets safely.
