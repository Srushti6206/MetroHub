# Pune Metro Hub

A hackathon prototype for Pune Metro station discovery, nearby shop browsing, sample ordering, and MetroMate recommendations. This is an independent demo, **not** an official Pune Metro or Maha Metro app.

## Run locally (Windows)

Requirements: Node.js, Python, and MongoDB Community Server. MongoDB Compass is only a database viewer; it does not run the database server.

1. Start MongoDB (if installed as a Windows service):

   ```powershell
   Start-Service MongoDB
   Test-NetConnection 127.0.0.1 -Port 27017
   ```

2. In a PowerShell window, install backend dependencies, seed safely, and start Flask:

   ```powershell
   cd .\backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python seed.py
   python app.py
   ```

   `python seed.py` is repeatable and does not reset the database. Do not use `--reset` unless you intentionally want to erase app collections.

3. In a second window, install frontend dependencies and start Vite:

   ```powershell
   npm install
   $env:VITE_API_BASE_URL = 'http://127.0.0.1:5000'
   npm run dev
   ```

   Open the local URL printed by Vite. Check Flask and MongoDB with `http://127.0.0.1:5000/api/health`; `database.connected` should be `true`.

For detailed MongoDB setup, environment variables, API routes, and tests, see [backend/README.md](backend/README.md).

## What the demo includes

- Station discovery across Purple, Aqua, and Line 3, with search, line/status filters, and interchange handling.
- Sample shop and product browsing, cart, checkout, order history, and demo owner controls.
- Server-side checkout validation of product availability and current prices.
- MetroMate recommendations grounded in the backend catalog, with budget, time, and vegetarian filtering.
- English, Hindi, and Marathi interface text.

## Data and limitations

- Shops, menus, prices, offers, and seeded orders are fictional sample data. No verified outlet records are currently imported.
- Station names and statuses are sourced from operator/authority references in `data/stations.json`. Verify current service with the operator before travel. Line 3 is marked as requiring status verification.
- MetroMate uses rule-based recommendations by default. An optional LLM provider can be configured on the Flask backend; keep API keys out of frontend code.
- Train times, shop hours, inventory reservations, and real payments are not provided. Owner controls are demo-only and are not authenticated.

## Checks

```powershell
npm test
npm run build
cd .\backend
python -m pytest -q
```

Tests use an in-memory MongoDB mock; run the app against local MongoDB for a live integration check.

## Project map

- `data/stations.json` — canonical station and route-status data shared with the backend seeder.
- `src/` — React frontend, API client, recommendation UI, and local cart/preferences state.
- `backend/` — Flask API, MongoDB access, repeatable seed, and backend tests.
- `backend/data/IMPORTING_OUTLETS.md` — process for adding source-verified outlets.
