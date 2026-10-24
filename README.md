# Pune Metro Hub 🚇

**Your Metro Stop, Your Shopping Spot.**

Pune Metro Hub is a hackathon prototype that helps commuters discover metro stations, explore shops and cafés, browse products and offers, place sample orders, and receive personalized recommendations from **MetroMate**, the in-app assistant.

This project aims to make waiting time more productive by connecting metro commuters with station-based shopping and local business discovery.

> **Disclaimer:** Pune Metro Hub is an independent demo project. It is not affiliated with or endorsed by Pune Metro, Maha Metro, or PMRDA.

## ✨ Features

- **Metro Station Discovery:** Explore stations across the Purple Line, Aqua Line, and Line 3, with station search, line and status filters, and interchange handling.
- **Station-Based Shop Discovery:** Browse sample shops, cafés, food outlets, products, and offers associated with metro stations.
- **MetroMate Assistant:** Get catalog-based recommendations according to budget, estimated preparation time, and dietary preferences.
- **Multilingual Interface:** Interface text available in English, Hindi, and Marathi.
- **Cart and Sample Ordering:** Add products to the cart, proceed through checkout, and view order history and status.
- **Shop Owner Dashboard:** Demo controls for managing products, prices, offers, and order statuses.
- **Backend Validation:** Server-side checkout validation checks product availability and current catalog prices.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, Flask |
| Database | MongoDB |
| Testing | Frontend test suite, production build, Pytest |
| AI recommendations | Rule-based by default; optional backend LLM provider |

## 🚀 Getting Started

### Prerequisites

Install the following on Windows:

- [Node.js](https://nodejs.org/)
- [Python](https://www.python.org/downloads/)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community)

MongoDB Compass is an optional database viewer; it does not replace the MongoDB server.

### 1. Start MongoDB

If MongoDB is installed as a Windows service, open PowerShell:

```powershell
Start-Service MongoDB
Test-NetConnection 127.0.0.1 -Port 27017
```

Confirm that the connection test succeeds before proceeding.

### 2. Set up and start the backend

Open a PowerShell terminal in the project root:

```powershell
cd .\backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
python seed.py
python app.py
```

Keep this terminal open while using the application.

**Database safety:** The seed script is designed to be repeatable and does not reset the database during normal execution. Do not use `--reset` unless you intentionally want to erase the application's collections.

### 3. Set up and start the frontend

Open a second PowerShell terminal in the project root:

```powershell
npm install

$env:VITE_API_BASE_URL = 'http://127.0.0.1:5000'

npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

### 4. Verify the backend

Open the following endpoint in your browser:

`http://127.0.0.1:5000/api/health`

Confirm that `database.connected` is `true`.

For additional setup details, environment variables, API routes, and backend-specific instructions, see [`backend/README.md`](backend/README.md).

## 🗺️ Station and Outlet Data

- `data/stations.json` contains the canonical station and route-status data used by the backend seeder.
- Interchange stations are represented using canonical station records and their associated lines.
- Outlet information can be extended using the instructions in [`backend/data/IMPORTING_OUTLETS.md`](backend/data/IMPORTING_OUTLETS.md).

**Data accuracy:** Shop names, menus, prices, offers, and seeded orders are fictional sample data. No verified outlet records are currently imported. Station names and statuses are documented in the project data, but current service status should be verified with the relevant metro operator before travel.

## 🤖 How MetroMate Works

MetroMate provides recommendations grounded in the application's backend catalog. It supports filtering by budget, estimated preparation time, and vegetarian preferences.

- Rule-based recommendations are used by default.
- An optional LLM provider can be configured on the Flask backend.
- AI-generated responses must not override catalog prices, product availability, or dietary information.
- API keys must remain server-side and must never be committed to GitHub or exposed in frontend code.

## ⚠️ Scope and Limitations

Pune Metro Hub is a prototype intended for demonstration and experimentation.

- MetroMate recommendations use the available catalog; real-world outlet availability is not verified.
- Real-time train arrivals and live metro service updates are not provided.
- Shop opening hours and live inventory are not guaranteed.
- Checkout is for sample orders; real payment processing is not implemented.
- Owner controls are for demonstration only and do not provide production-grade authentication.
- Line 3 station/service status requires verification before being treated as operational.

## 🧪 Run Tests

From the project root, run the frontend checks:

```powershell
npm test
npm run build
```

Then run the backend tests:

```powershell
cd .\backend
python -m pytest -q
```

The automated backend tests use an in-memory MongoDB mock. Run the application against local MongoDB separately to verify live integration.

## 📁 Project Structure

```text
pune-metro-hub/
├── data/
│   └── stations.json
├── src/
│   └── React frontend, API client, and UI
├── backend/
│   ├── app.py
│   ├── routes/
│   ├── data/
│   │   └── IMPORTING_OUTLETS.md
│   ├── tests/
│   ├── seed.py
│   └── README.md
├── package.json
└── README.md
```

*The structure above is representative; exact filenames may vary as the project evolves.*

## 🔐 Security Notes

- Keep `.env` files, API keys, database credentials, and other secrets out of version control.
- Use environment variables for backend configuration.
- Do not expose MongoDB directly to public networks.
- Demo owner controls and sample checkout flows must not be used as production security mechanisms.

## 🎯 Project Goal

**Make every metro minute count.**

Pune Metro Hub brings station discovery, local shopping, sample ordering, and personalized recommendations together in one commuter-friendly platform.
