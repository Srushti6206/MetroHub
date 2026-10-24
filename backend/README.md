# Pune Metro Hub — Flask + MongoDB backend

Independent hackathon prototype (not an official Pune Metro app). Shops/menus/orders are fictional demo data.
Stack: Flask + PyMongo + **local MongoDB Community Server**. No Atlas, no cloud account.

> **MongoDB Compass is only a GUI.** It does not contain the database server. You must have
> *MongoDB Community Server* installed and running. Steps 1–3 check that.

## 1. Is MongoDB Community Server installed? (PowerShell)
```powershell
Get-Service | Where-Object { $_.Name -like "*mongo*" }          # a service named MongoDB (or similar)?
Get-Command mongod -ErrorAction SilentlyContinue                # mongod.exe on PATH?
Test-Path "C:\Program Files\MongoDB\Server"                     # default install folder
```
If the service list is empty and the folder does not exist, install it (step 2). Use whatever service name step 1 printed.

## 2. Install (only if missing)
Option A — winget:
```powershell
winget install MongoDB.Server
```
Option B — installer: download "MongoDB Community Server" (Windows, msi) from mongodb.com/try/download/community and run it.
Choose **Complete** and tick **Install MongoDB as a Service**. You may untick the bundled Compass if you already have it.

## 3. Start it and verify
```powershell
Start-Service MongoDB                 # replace MongoDB with the service name printed in step 1
Get-Service MongoDB                   # Status should be Running
Test-NetConnection 127.0.0.1 -Port 27017   # TcpTestSucceeded : True
```
No service (manual install)? Run it in a separate window with your own data folder:
```powershell
mkdir C:\data\db -Force
& "C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe" --dbpath C:\data\db --bind_ip 127.0.0.1
```
(Check the real `<version>` folder name under `C:\Program Files\MongoDB\Server`.)

## 4. Open Compass
Compass → New connection → URI `mongodb://127.0.0.1:27017` → Connect.
After seeding (step 7) you will see database `pune_metro_hub` with collections `stations, shops, products, offers, orders`.

## 5. Python environment
```powershell
cd pune-metro-hub\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope Process Bypass
pip install -r requirements.txt
```

## 6. Configure
```powershell
Copy-Item .env.example .env           # defaults point at local MongoDB and pune_metro_hub
```
The `.env.example` file is in `backend`. Edit `backend\.env` to add your OpenAI API key and a model enabled for your account, for example:
```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4o-mini
```
Keep this key in `backend\.env` only. Do not put it in the frontend `.env`, source code, screenshots, or commits. The backend `.env` is ignored by Git. The model name is an example; use one available to your OpenAI account.

Other settings include `MONGO_URI`, `MONGO_DB_NAME`, `CORS_ORIGINS` (frontend origin only), and `AI_TIMEOUT_SECONDS`.

## 7. Seed (safe to repeat)
```powershell
python seed.py
```
Inserts missing demo documents, refreshes canonical station metadata, and synchronizes only the source-managed curated outlet imports; it preserves customer orders, products' editable fields, and owner catalog data. It does not delete collections. If MongoDB is unreachable it prints an actionable error and exits. To wipe and reseed **explicitly**: `python seed.py --reset --yes`.
The canonical station/status source is `../data/stations.json` and is shared by the frontend and backend seeder. The fictional demo catalog is `backend/data/catalog.json`; it can be regenerated from `src/data/seed.ts` by `npx tsx scripts/export-seed.ts` (run from the project root) if demo products or shops change. Verified outlet imports use `backend/data/station_outlets.json`; see `backend/data/IMPORTING_OUTLETS.md`.

## 8. Start Flask
```powershell
python app.py                          # http://127.0.0.1:5000
Invoke-RestMethod http://127.0.0.1:5000/api/health   # database.connected must be True (real ping)
```

## 9. Start the frontend (second PowerShell window, project root)
```powershell
cd pune-metro-hub
npm install
Copy-Item .env.example .env            # VITE_API_BASE_URL=http://127.0.0.1:5000
npm run dev                            # http://localhost:5173
```
`VITE_API_BASE_URL` is read at build time; restart `npm run dev` after changing it.

## 10. Test MetroMate AI
Without an API key (rule-based, grounded in MongoDB):
```powershell
$st = (Invoke-RestMethod http://127.0.0.1:5000/api/stations | Where-Object display_name -like "District*").id
$body = @{ message = "Suggest vegetarian snacks under Rs 100"; station_id = $st } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:5000/api/chat -ContentType "application/json" -Body $body
```
The response has `mode: "rule_based"`.

With a key (your own OpenAI account):
```powershell
# in backend\.env
AI_PROVIDER=openai
OPENAI_API_KEY=<your key>
OPENAI_MODEL=gpt-4o-mini
```
Replace the example model with one your account supports, then restart Flask. `/api/health` should show `chat_mode: "llm"`, and MetroMate's header will show that OpenAI is configured. The model receives current website facts for the selected station (stations, shops, products, offers, and demo limitations), plus products already filtered by station, budget, diet, availability, and preparation time. It is instructed to answer only from this context and to cite website-fact IDs; unknown source IDs and product IDs are rejected. The backend recomputes prices and totals from MongoDB, and provider/validation failures fall back to rule-based recommendations. This grounding reduces unsupported answers but cannot guarantee that a language model will never make a mistake. **The live provider path has not been run against your account** (tests mock the OpenAI response).

## Tests (no MongoDB server and no API key needed)
```powershell
python -m pytest -q
```
They use `mongomock` (in-memory fake). That proves application logic, **not** behaviour of a real mongod, so also run the
manual flow below against real MongoDB.

## API summary
- `GET /api/health`
- `GET /api/stations[/<id>]` (filters: `line`, `status`, `q`), `GET /api/stations/<id>/shops`, `GET /api/shops[/<id>[/products]]`, `GET /api/products[/<id>]`
  (filters: station_id, shop_id, category, q, available, vegetarian, max_price_paise), `GET /api/offers`
- `POST/GET /api/orders`, `GET /api/orders/<id | PMH-number>`, `PATCH /api/orders/<id>/status` (demo "advance")
- Owner (header `X-Demo-Owner-Shop: <shop id>`): `GET /api/owner/orders|products|offers`,
  `PATCH /api/owner/orders/<id>/status`, `POST/PATCH/DELETE /api/owner/products[/<id>]`, `POST/PATCH/DELETE /api/owner/offers[/<id>]`
- `POST /api/chat`

## Indexes
orders.order_number (unique); orders (shop_id, status), station_id, created_at; shops (station_ids, is_active), category;
products (shop_id, is_available), category, name; offers (shop_id, is_active); stations is_active.

## Design notes and limitations
- Prices are integer paise. Orders embed price snapshots; later edits don't change history.
- Order creation validates everything, then performs a single `insert_one` (atomic per document). No multi-document
  transaction (standalone mongod has none). Availability is **checked at checkout, not reserved**: concurrent orders for
  the last unit are not prevented.
- One shop per order; the frontend splits a mixed cart into one order per shop.
- **Owner mode is demo access** (shop picked via header). It is NOT authentication and not production-secure.
  There are no customer accounts, so every browser sees all demo orders.
- Station names/corridors come from Maha Metro's station/project profile and the PMRDA Line 3 alignment gazette. Current Line 3 passenger-service status is unverified and labeled accordingly; PCMC–Nigdi and Swargate–Katraj are marked under construction per Maha Metro updates. Verify before travel.
- Existing singular `station_id` shop records remain readable alongside canonical `station_ids`. Records without either relationship are deliberately not assigned to a station.
- Pickup windows are estimates from preparation time; no live train or shop data.
- Flat-amount offers are supported by the API, but the existing UI only edits percentage offers.
- Chat rate limit is in-memory per process (local dev only).

## Manual acceptance flow (run against real MongoDB)
Seed → start Flask → start frontend → MetroMate: "vegetarian snacks under ₹100" → Add recommendation → Checkout → note the
order number → Compass: `orders` has it with matching `total_paise` → Owner (same shop) → Accept → reload the customer
order page → status updated → Owner → edit a price → `GET /api/products/<id>` returns the new price.
