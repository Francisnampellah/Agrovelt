# Local Agrovet Pipeline

This branch is for testing the Agrovet purchase-to-inventory flow without using the live Agrovet backend.

## Branch Rules

- `main` / `shoko`: incoming shared work. Do not assume it is deploy-ready.
- `release/agrovet`: curated deploy branch for production-safe implementation changes.
- `local/agrovet-pipeline`: private/local testing branch. Keep local emulator and dev-server setup here.

When taking changes from another developer, prefer cherry-picking the useful implementation commits or hunks. Do not merge local mocks, hardcoded localhost URLs, demo seed defaults, or broad emulator assumptions into a deploy branch.

## Local Runtime Shape

Use:

- real Firebase Auth
- real Firestore
- local Firebase Functions emulator
- local Agrovet backend on `http://localhost:4000`
- local Postgres through Docker

Do not use the Firebase Auth emulator for this flow. Emulator Auth tokens cannot be verified by the Agrovet backend Firebase Admin SDK.

## Backend

From `AMD_agrovet_backend`:

```bash
docker compose up db -d
npx prisma db push
npm run prisma:seed
npm run dev
```

The seed command imports the **built-in demo catalog** (CUSTOM products) by default for local testing.

```env
SEED_BUILTIN_CATALOG=true   # default — demo fertilizers/pesticides/etc.
SEED_FIREBASE_PRODUCTS=true # optional — also sync Mnyama Shop Firestore catalog
```

To skip the demo catalog (Mnyama-only):

```env
SEED_BUILTIN_CATALOG=false
SEED_FIREBASE_PRODUCTS=true
```

## Cloud Functions

From `AMD_firebase_cloud_functions`:

```bash
npm run emulators:functions
```

For this local pipeline, `functions/.env` should include:

```env
AGROVET_BACKEND_URL=http://localhost:4000
CLIENT_FIREBASE_API_KEY=<firebase web api key>
AZAMPAY_MOCK=false
```

The deploy guard fails deployment if `AZAMPAY_MOCK=true` or if `AGROVET_BACKEND_URL` points at localhost.

## Web App

From `AMD_web_app`:

```bash
npm run dev
```

For this local pipeline, `.env` should include:

```env
VITE_USE_FIREBASE_EMULATORS=false
VITE_USE_FUNCTIONS_EMULATOR=true
VITE_AGROVET_BACKEND_DEV_URL=http://localhost:4000
VITE_AGROVET_USE_MOCK_API=false
```

Restart the Vite dev server after changing env values.

## Test Flow

1. Log in with a real Firebase user that has an Agrovet-compatible `globalRole`.
2. Confirm Agrovet token exchange succeeds against the local backend.
3. Sync Mnyama Shop products into local Agrovet catalog.
4. Purchase a product from Mnyama Shop.
5. Confirm the order through the web app.
6. The local Functions emulator should call the local Agrovet backend.
7. The purchased product should appear in the Agrovet main shop inventory.
8. Record a sale and confirm inventory decreases.

## Deployment Rule

Deploy only from a curated branch. Before deploy, confirm:

```env
VITE_USE_FIREBASE_EMULATORS=false
VITE_USE_FUNCTIONS_EMULATOR=false
VITE_AGROVET_USE_MOCK_API=false
AGROVET_BACKEND_URL=https://mnyamacollector.afyamnyamaserver.com
AZAMPAY_MOCK=false
SEED_BUILTIN_CATALOG=false
```
