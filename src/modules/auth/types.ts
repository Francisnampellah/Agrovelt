import { Role } from '@prisma/client'
import { Request } from 'express'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  role?: Role
  organizationId?: string
}

export interface ExchangeRequest {
  firebaseToken: string
  clientType: 'web' | 'mobile'
  deviceId?: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    name: string
    email: string
    role: string
    organizationId?: string
    shopScope?: string[]
  }
}

export interface AuthResponse {
  user: {
    id: string
    name: string
    email: string
    role: string
    organizationId?: string
  }
  token: string
  refreshToken: string
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
  organizationId?: string
  iat?: number
  exp?: number
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload
}
