import { TokenResponse } from './types'

export interface CollectorAuthUser {
  id: string
  name: string
  email: string
  role: string
  organizationId?: string | null
  isActive: boolean
  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
  allShops?: boolean
  shopScope?: string[]
  shops?: { shopId: string; name: string }[]
}

/** Mobile app accepts token | accessToken at top-level or under data */
export function formatCollectorAuthResponse(
  message: string,
  tokens: {
    accessToken: string
    token?: string
    refreshToken: string
    expiresIn: number
  },
  user: CollectorAuthUser,
  data?: Record<string, unknown>
) {
  const accessToken = tokens.token ?? tokens.accessToken

  return {
    message,
    token: accessToken,
    accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user,
    ...(data ? { data: { ...data, token: accessToken, accessToken, refreshToken: tokens.refreshToken, user } } : {})
  }
}

export function collectorUserFromExchange(result: TokenResponse): CollectorAuthUser {
  const u = result.user
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    organizationId: u.organizationId ?? null,
    isActive: u.isActive,
    managerAccess: u.managerAccess ?? null,
    ...(u.allShops !== undefined ? { allShops: u.allShops } : {}),
    ...(u.shopScope ? { shopScope: u.shopScope } : {}),
    ...(u.shops ? { shops: u.shops } : {})
  }
}
