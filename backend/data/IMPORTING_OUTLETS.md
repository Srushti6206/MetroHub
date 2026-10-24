# Importing verified station outlets

The app currently contains only synthetic sample outlets. Do not change their type to `verified` or infer an outlet's station from proximity.

To add a real outlet, add an entry to `station_outlets.json` and run `python seed.py` from `backend`. The importer upserts only records under its deterministic `curated-shop:` / `curated-product:` IDs; it does not delete or reset collections. Use a unique stable `id` for each outlet and product.

Each outlet entry must include:

- `id`, `name`, `category`, `description`
- `station_ids`: canonical IDs from the root `data/stations.json`
- `location_type`: `inside_station`, `station_premises`, or `nearby_outside`
- `source_url`, `verification_status: "verified"`, and `last_verified_at` (`YYYY-MM-DD`)
- `products`: entries with unique `id`, `name`, integer `price_paise`, and boolean `is_vegetarian`

Optional outlet data includes `distance_metres`, `address`, `opening_hours`, `contact`, and `coordinates`. Optional product data includes `description`, `category`, `dietary_tags`, `is_available`, and `preparation_minutes`. Only include facts directly supported by the source and recheck prices, hours, and availability before demos. No unverified outlet examples are included in this file.
