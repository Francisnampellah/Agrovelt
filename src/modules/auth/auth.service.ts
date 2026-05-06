import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { PrismaClient, Role } from '@prisma/client'
import { firebaseAuth } from '../../config/firebase'
import { LoginRequest, RegisterRequest, AuthResponse, JWTPayload, ExchangeRequest, TokenResponse } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = '15m' // Short-lived access token
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7 // Long-lived refresh token

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex')
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const { name, email, password, role = Role.STAFF, organizationId } = data

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      throw new Error('User already exists with this email')
    }

    // Role-specific validation
    if (role === Role.SUPER_ADMIN) {
      if (organizationId) {
        throw new Error('SUPER_ADMIN cannot be associated with an organization')
      }
    } else {
      if (!organizationId) {
        throw new Error('Organization ID is required for non-SUPER_ADMIN roles')
      }
      // Check if organization exists
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId }
      })
      if (!org) {
        throw new Error('Organization not found')
      }
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        ...(organizationId ? { organization: { connect: { id: organizationId } } } : {})
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    // Generate JWT token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // Generate and store refresh token
    const refreshToken = this.generateRefreshToken()
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000)
      }
    })

    // Log activity
    await this.logActivity(user.id, 'REGISTER', 'User', user.id, { role: user.role })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const { email, password } = data

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email }
    })

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    if (!user.passwordHash) {
      throw new Error('User must use Firebase authentication')
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Generate JWT token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // Generate and store refresh token
    const refreshToken = this.generateRefreshToken()
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000)
      }
    })

    // Log activity
    await this.logActivity(user.id, 'LOGIN', 'User', user.id)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    }
  }

  async exchangeFirebaseToken(data: ExchangeRequest): Promise<TokenResponse> {
    const { firebaseToken, clientType, deviceId } = data

    try {
      // 1. Verify Firebase ID token
      const decodedToken = await firebaseAuth.verifyIdToken(firebaseToken)
      
      // 2. Check globalRole claim
      if (decodedToken.globalRole !== 'agrovelt') {
        throw new Error('Unauthorized: Invalid domain claim')
      }

      const { uid, email, name: fbName } = decodedToken
      if (!email) throw new Error('Firebase token missing email')

      // 3. Upsert/find Agrovelt user in Prisma
      let user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          shopsOwned: { select: { id: true } },
          staffIn: { select: { shopId: true } }
        }
      })

      if (!user) {
        // Do not auto-provision users without organization context.
        // Require that users are created/assigned to an organization beforehand.
        throw new Error('User not provisioned. Please register through the organization.')
      } else if (!user.firebaseUid) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: uid },
          include: {
            shopsOwned: { select: { id: true } },
            staffIn: { select: { shopId: true } }
          }
        })
      }

      if (!user.isActive) {
        throw new Error('User account is deactivated')
      }

      // 4. Resolve shop scope
      const shopScope = [
        ...user.shopsOwned.map(s => s.id),
        ...user.staffIn.map(s => s.shopId)
      ]

      // 5. Issue backend tokens
      const accessToken = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      })

      const refreshToken = this.generateRefreshToken()
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          deviceId: deviceId || null,
          clientType,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000)
        }
      })

      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopScope
        }
      }
    } catch (error: any) {
      throw new Error(`Exchange failed: ${error.message}`)
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        shopsOwned: {
          select: {
            id: true,
            name: true,
            location: true
          }
        },
        staffIn: {
          select: {
            shop: {
              select: {
                id: true,
                name: true,
                location: true
              }
            },
            role: true
          }
        }
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    return user
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    // Log activity
    await this.logActivity(userId, 'UPDATE_PROFILE', 'User', userId, data)

    return user
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Verify old password
    if (!user.passwordHash) {
      throw new Error('User must use Firebase authentication to change password')
    }

    const isValidPassword = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!isValidPassword) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    })

    // Log activity
    await this.logActivity(userId, 'CHANGE_PASSWORD', 'User', userId)
  }

  async deactivateUser(userId: string, adminId: string) {
    // Check if admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId }
    })

    if (admin?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required')
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true
      }
    })

    // Log activity
    await this.logActivity(adminId, 'DEACTIVATE_USER', 'User', userId, { targetUser: user.email })

    return user
  }

  async getUsers(adminId: string) {
    // Check if admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId }
    })

    if (admin?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required')
    }

    return await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  private generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  async blockToken(token: string, decoded: JWTPayload) {
    if (decoded.exp) {
      const expiresAt = new Date(decoded.exp * 1000)
      await this.prisma.tokenBlocklist.create({
        data: {
          token,
          expiresAt
        }
      }).catch(err => {
        // Ignore unique constraint violations (token already blocked)
      })
    }
  }

  async isTokenBlocked(token: string): Promise<boolean> {
    const blockedToken = await this.prisma.tokenBlocklist.findUnique({
      where: { token }
    })
    return !!blockedToken
  }

  async logout(userId: string, currentToken: string, refreshToken?: string) {
    // 1. Block access token
    try {
      const decoded = jwt.decode(currentToken) as JWTPayload
      if (decoded && decoded.exp) {
        await this.blockToken(currentToken, decoded)
      }
    } catch (e) {
      // Intentionally ignore decode issues during logout
    }

    // 2. Revoke the refresh token if provided
    if (refreshToken) {
      await this.prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { isRevoked: true }
      }).catch(err => {
        // Ignore if refresh token doesn't exist
      })
    }

    await this.logActivity(userId, 'LOGOUT', 'User', userId)
  }

  async refreshTokens(refreshToken: string, deviceId?: string): Promise<{ token: string, refreshToken: string }> {
    // Find refresh token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    })

    // Validate
    if (!tokenRecord) {
      throw new Error('Invalid refresh token')
    }

    if (tokenRecord.isRevoked) {
      throw new Error('Refresh token has been revoked')
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new Error('Refresh token has expired')
    }

    if (!tokenRecord.user.isActive) {
      throw new Error('User account is deactivated')
    }

    // Device binding check
    if (tokenRecord.deviceId && deviceId && tokenRecord.deviceId !== deviceId) {
      throw new Error('Refresh token bound to another device')
    }

    // Revoke old refresh token (Token Rotation)
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true }
    })

    // Generate new JWT
    const newAccessToken = this.generateToken({
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role
    })

    // Generate and store new refresh token
    const newRefreshToken = this.generateRefreshToken()
    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: tokenRecord.user.id,
        deviceId: deviceId || tokenRecord.deviceId || null,
        clientType: tokenRecord.clientType,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000)
      }
    })

    await this.logActivity(tokenRecord.user.id, 'REFRESH_TOKEN', 'User', tokenRecord.user.id)

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken
    }
  }

  private async logActivity(userId: string, action: string, entity: string, entityId: string, metadata?: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          metadata: metadata || null
        }
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
      // Don't throw error to avoid breaking main flow
    }
  }
}