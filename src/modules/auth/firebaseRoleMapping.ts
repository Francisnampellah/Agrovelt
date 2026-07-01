import { Role } from '@prisma/client'

/**
 * Platform-wide Firebase custom claim `globalRole` (identity / product line).
 * Set via Admin SDK or Cloud Function when Firestore role changes.
 */
export const PLATFORM_GLOBAL_ROLES = ['agrovet', 'farmer', 'vet', 'admin', 'dev'] as const

export type PlatformGlobalRole = typeof PLATFORM_GLOBAL_ROLES[number]

/**
 * Roles allowed to exchange tokens on the Agrovet POS API (Collector service).
 * farmer / vet use other apps — not this exchange.
 */
export const AGROVET_EXCHANGE_GLOBAL_ROLES = ['agrovet', 'admin', 'dev'] as const

export type AgrovetExchangeGlobalRole = typeof AGROVET_EXCHANGE_GLOBAL_ROLES[number]

/** @deprecated Use AGROVET_EXCHANGE_GLOBAL_ROLES */
export const ALLOWED_FIREBASE_GLOBAL_ROLES = AGROVET_EXCHANGE_GLOBAL_ROLES

export type FirebaseGlobalRole = AgrovetExchangeGlobalRole

export function normalizePlatformGlobalRole(role: unknown): PlatformGlobalRole | null {
  if (typeof role !== 'string') return null
  const normalized = role.trim().toLowerCase()
  return PLATFORM_GLOBAL_ROLES.includes(normalized as PlatformGlobalRole)
    ? (normalized as PlatformGlobalRole)
    : null
}

export function normalizeAgrovetExchangeGlobalRole(role: unknown): AgrovetExchangeGlobalRole | null {
  if (typeof role !== 'string') return null
  const normalized = role.trim().toLowerCase()
  return AGROVET_EXCHANGE_GLOBAL_ROLES.includes(normalized as AgrovetExchangeGlobalRole)
    ? (normalized as AgrovetExchangeGlobalRole)
    : null
}

/** @deprecated Use normalizeAgrovetExchangeGlobalRole */
export function normalizeFirebaseGlobalRole(role: unknown): AgrovetExchangeGlobalRole | null {
  return normalizeAgrovetExchangeGlobalRole(role)
}

export type ExchangeGlobalRoleSource = 'token' | 'body' | 'none'

/**
 * Resolve globalRole for /api/auth/exchange.
 * 1. Prefer verified ID token custom claim
 * 2. Fall back to request body (mobile: Firestore user_role) — agrovet only
 * 3. Reject farmer/vet with explicit message (wrong API)
 */
export function resolveExchangeGlobalRole(
  tokenClaim: unknown,
  bodyGlobalRole?: unknown
): {
  role: AgrovetExchangeGlobalRole | null
  source: ExchangeGlobalRoleSource
  rejectReason?: string
} {
  const fromToken = normalizeAgrovetExchangeGlobalRole(tokenClaim)
  if (fromToken) {
    return { role: fromToken, source: 'token' }
  }

  const platformFromToken = normalizePlatformGlobalRole(tokenClaim)
  if (platformFromToken === 'farmer' || platformFromToken === 'vet') {
    return {
      role: null,
      source: 'none',
      rejectReason:
        `globalRole "${platformFromToken}" is not valid for the Agrovet POS API. Use the ${platformFromToken} app.`
    }
  }

  const fromBody = normalizeAgrovetExchangeGlobalRole(bodyGlobalRole)
  if (fromBody === 'agrovet') {
    return { role: fromBody, source: 'body' }
  }

  const platformFromBody = normalizePlatformGlobalRole(bodyGlobalRole)
  if (platformFromBody === 'farmer' || platformFromBody === 'vet') {
    return {
      role: null,
      source: 'none',
      rejectReason:
        `globalRole "${platformFromBody}" cannot access Agrovet POS. Firestore role must be agrovet for this API.`
    }
  }

  const tokenDisplay =
    tokenClaim === undefined || tokenClaim === null ? 'missing' : String(tokenClaim)
  const bodyDisplay =
    bodyGlobalRole === undefined || bodyGlobalRole === null ? 'missing' : String(bodyGlobalRole)

  return {
    role: null,
    source: 'none',
      rejectReason:
      `Missing agrovet platform role. Token globalRole=${tokenDisplay}, body globalRole=${bodyDisplay}. ` +
      `Agrovet POS requires globalRole "agrovet" on the token or in the exchange body ` +
      `(from Firestore user_role). admin/dev must be on the token. Set claim via Admin SDK and re-login.`
  }
}

export function mapFirebaseGlobalRoleToAgrovetRole(role: AgrovetExchangeGlobalRole): Role {
  switch (role) {
    case 'dev':
      return Role.SUPER_ADMIN
    case 'admin':
      return Role.ADMIN
    case 'agrovet':
      return Role.OWNER
  }
}
