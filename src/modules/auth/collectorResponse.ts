import { TokenResponse } from './types'

export interface CollectorAuthUser {
  id: string
  name: string
  email: string
  role: string
  organizationId?: string | null
  isActive: boolean
  shopScope?: string[]
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
    ...(u.shopScope ? { shopScope: u.shopScope } : {})
  }
}
