# Agrovet auth & token exchange — frontend contract for backend

This document describes how the Afya Mnyama mobile app authenticates agrovet users and talks to the Collector POS API. Use it to align backend validation, token issuance, and response shapes with what the app actually sends and expects.

## Backend implementation status (this repo)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Verify Firebase tokens for project `afya-mnyama-digital` | Config via `FIREBASE_PROJECT_ID` / credentials — **production must use afya-mnyama-digital** |
| 2 | Allow exchange only when Firestore `users/{uid}.role` is `agrovet` | `exchangeFirebaseToken()` reads Firestore after token verification |
| 3 | Do not require `globalRole: "collector"` | Removed — `collector` is the API name only |
| 4 | Auto-create collector user on first exchange | `exchangeFirebaseToken()` upserts Prisma user |
| 5 | Return `organizationId: null` for new users | Yes — `user.organizationId` from DB |
| 6 | `POST /organizations` returns new JWT + `organizationId` | `formatCollectorAuthResponse()` — top-level + `data` |
| 7 | POS routes accept `Authorization: Bearer <collector JWT>` | Existing auth middleware |
| 8 | Error bodies `{ "error": "..." }` | Exchange/org controllers |

**Response helpers:** `src/modules/auth/collectorResponse.ts` — returns `token`, `accessToken`, `refreshToken`, `expiresIn`, `user` (with `isActive`) at top level and under `data` when nested payload is needed.

**Role source of truth:** Mobile navigation and backend exchange now align on Firestore `users/{uid}.role`. Firebase custom claims are treated as secondary metadata and may be synced after successful exchange, but they do not decide access.

**Org users list:** Mobile references `GET /organizations/{id}/users`. This API exposes `GET /api/users` (ADMIN) instead — wire mobile to that or add an org-scoped route if needed.

---

## 1. Two separate auth layers

| Layer | Purpose | Token | Issuer |
|-------|---------|-------|--------|
| Platform auth | Login, profile, verification, subscriptions | Firebase ID token | Firebase Auth (`afya-mnyama-digital`) |
| Collector POS auth | Shops, inventory, sales, receipts, org users | Collector JWT | `mnyamacollector.afyamnyamaserver.com` |

Agrovet users must pass both. Firebase login alone is not enough to use POS features.

## 2. Firebase project (must match backend Admin SDK)

| Field | Value |
|-------|-------|
| Project ID | `afya-mnyama-digital` |
| Auth domain | `afya-mnyama-digital.firebaseapp.com` |
| Android package | `com.mnyamacheck.app` |
| Token `aud` | `afya-mnyama-digital` |
| Token `iss` | `https://securetoken.google.com/afya-mnyama-digital` |

## 3. Role model

### 3.1 Platform role (`globalRole`) — Firebase / Firestore

- Stored in Firestore `users/{uid}.role` and may also be mirrored as Firebase custom claim `globalRole`.
- `agrovet` is a valid `globalRole`.
- **`collector` is NOT a `globalRole`.** “Collector” is only the name of the POS API service.

Mobile runs collector auth when: `userRole.toLowerCase() == 'agrovet'`.

### 3.2 Organization role — Collector API

Returned in exchange/org-create responses as `user.role`: `OWNER`, `ADMIN`, `STAFF`, etc.

## 4. End-to-end login flow (agrovet only)

Preconditions before collector exchange:

- Firebase user signed in
- Firestore `users/{uid}.role == "agrovet"`
- `verification_status == "verified"`
- `on_boarding_complete == true`
- User has an email on the Firebase account

The app does **not** use `POST /api/auth/login` or `POST /api/auth/register` for primary agrovet login.

## 5. Step 1 — Token exchange

**Request:** `POST /api/auth/exchange`

```json
{
  "firebaseToken": "<Firebase ID token>",
  "clientType": "mobile",
  "deviceId": "<Firebase UID>",
  "globalRole": "agrovet"
}
```

**Success response (200):**

```json
{
  "message": "Token exchange successful",
  "token": "<access JWT>",
  "accessToken": "<access JWT>",
  "refreshToken": "<optional>",
  "expiresIn": 3600,
  "user": {
    "id": "collector-user-uuid",
    "name": "Shop Owner",
    "email": "owner@example.com",
    "role": "OWNER",
    "organizationId": "org-uuid-or-null",
    "isActive": true
  }
}
```

App also accepts: `access_token`, nested `data.token`, `data.user`, etc.

## 6. Step 2 — Organization creation

**Request:** `POST /api/organizations` with `Authorization: Bearer <collector JWT>`

```json
{
  "name": "My Agrovet Shop",
  "slug": "my-agrovet-shop",
  "email": "shop@example.com",
  "phoneNumber": "+255712345678"
}
```

**Success (201):** Top-level `token`, `accessToken`, `refreshToken`, `user.organizationId`, `user.role` (`OWNER`), plus `data.organization`.

## 7. Subsequent POS API calls

Base URL: `https://mnyamacollector.afyamnyamaserver.com/api`

`Authorization: Bearer <collector_auth_token>` — not Firebase token.

Refresh: app stores `collector_refresh_token` but does not call `/api/auth/refresh-token` yet.

## 8. Local storage keys (mobile)

`collector_auth_token`, `collector_refresh_token`, `collector_user_id`, `collector_organization_id`, `collector_profile_role`, `collector_sync_email`, `collector_device_id`, `user_role`.

## 9. Recommended: Firebase custom claims

When Firestore `users/{uid}.role` is set to `agrovet`:

```js
admin.auth().setCustomUserClaims(uid, { globalRole: 'agrovet' });
```

Backend also syncs this claim when exchange succeeds via body fallback (`globalRole: "agrovet"`).

## 10. Quick test contract

1. Create Firebase user in `afya-mnyama-digital`
2. Firestore: `{ role: "agrovet", verification_status: "verified", on_boarding_complete: true }`
3. Custom claim optional: `{ globalRole: "agrovet" }`
4. `POST /api/auth/exchange` with real ID token + `globalRole: "agrovet"`
5. Expect 200, JWT, `user.organizationId` null or set
6. If null, `POST /api/organizations` → new JWT + `organizationId`

See also: `FIREBASE_EXCHANGE_TROUBLESHOOTING.md`, `scripts/provision-firebase-global-role.ts`.
