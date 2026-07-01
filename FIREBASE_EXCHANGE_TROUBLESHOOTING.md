# Firebase Exchange — Role Model & Troubleshooting

## Role layers (do not confuse these)

| Layer | Field | Examples | Where it lives |
|-------|--------|----------|----------------|
| **Platform** | `globalRole` | `agrovet`, `farmer`, `vet`, `admin`, `dev` | Firebase **custom claim** on ID token |
| **POS org** | `role` | `OWNER`, `ADMIN`, `STAFF` | Collector API JWT + Prisma after exchange |

**“Collector”** is the name of the POS API service (`mnyamacollector.afyamnyamaserver.com`). It is **not** a `globalRole`.

Firestore `user_role: agrovet` does **not** automatically appear on the Firebase ID token. The backend must read it from the claim **or** accept it in the exchange body (see below).

---

## What `/api/auth/exchange` checks

```
POST /api/auth/exchange
{
  "firebaseToken": "<Firebase ID token>",
  "clientType": "mobile",
  "deviceId": "...",
  "globalRole": "agrovet"   // optional — from Firestore user_role when claim missing
}
```

### Resolution order

1. **`globalRole` on verified ID token** (preferred)
2. **`globalRole` in request body** — only `agrovet` allowed as fallback
3. **`admin` / `dev`** — token claim only (not accepted from body)
4. **`farmer` / `vet`** — rejected for this API (wrong product)

### After successful body fallback (`agrovet`)

The backend calls:

```ts
admin.auth().setCustomUserClaims(uid, { globalRole: 'agrovet' })
```

Next sign-in / `getIdToken(true)` will include the claim on the token.

---

## Mapping (platform → POS DB role)

| Token/body `globalRole` | Prisma `role` after exchange |
|-------------------------|------------------------------|
| `agrovet` | `OWNER` |
| `admin` | `ADMIN` |
| `dev` | `SUPER_ADMIN` |

Org-scoped roles (`OWNER` / `ADMIN` / `STAFF` in JWT) come from Prisma and organization membership — not from `globalRole` alone.

---

## Your mobile 401 — typical cause

```
Firebase Auth: OK
Firestore user_role: agrovet
Token globalRole claim: (missing)
Exchange without body globalRole → 401 Invalid domain claim
```

**Fix (app — already done):** send `globalRole: "agrovet"` in exchange body from Firestore.

**Fix (backend — this repo):** exchange accepts body fallback + syncs claim to Firebase.

**Long-term (recommended):** Cloud Function on Firestore `role` change:

```ts
await admin.auth().setCustomUserClaims(uid, { globalRole: 'agrovet' })
```

---

## Firebase project

Mobile uses **`afya-mnyama-digital`**. Server Admin SDK must use the **same** project.

| Config | Project |
|--------|---------|
| Mobile `google-services.json` | `afya-mnyama-digital` |
| `.env.example` `FIREBASE_PROJECT_ID` | `afya-mnyama-digital` |
| Wrong local file `firebase-credentials.json` | may be `agrovelt` — fix before testing mobile tokens |

---

## Provision claim manually

```bash
export FIREBASE_CREDENTIALS_FILE=./afya-mnyama-digital-firebase-adminsdk-....json
npx ts-node scripts/provision-firebase-global-role.ts user@example.com agrovet
```

User must sign out/in (or `getIdToken(true)`).

---

## Example success response

```json
{
  "message": "Token exchange successful",
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "user": {
    "id": "...",
    "role": "OWNER",
    "organizationId": "...",
    "shopScope": []
  }
}
```

---

## Example errors

**Missing claim and body:**

```json
{
  "error": "Exchange failed: Unauthorized: Invalid domain claim. Token globalRole=missing, body globalRole=missing. Agrovet POS requires globalRole \"agrovet\" on the token or in the exchange body..."
}
```

**Farmer on Agrovet API:**

```json
{
  "error": "Exchange failed: Unauthorized: globalRole \"farmer\" cannot access Agrovet POS..."
}
```

---

## Mobile debug logs to match

```
Agrovet: Firebase token globalRole claim=(missing) firestoreRole=agrovet
```

With backend update + app sending body `globalRole: agrovet` → exchange should succeed even when claim is missing.

After first success, claim is synced; next login should show `claim=agrovet`.

---

## Related code

| File | Purpose |
|------|---------|
| `src/modules/auth/auth.service.ts` | `exchangeFirebaseToken()` |
| `src/modules/auth/firebaseRoleMapping.ts` | `resolveExchangeGlobalRole()` |
| `src/modules/auth/types.ts` | `ExchangeRequest.globalRole` |
| `scripts/provision-firebase-global-role.ts` | Manual claim setup |
