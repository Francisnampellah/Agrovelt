import { PrismaClient } from '@prisma/client'
import { firebaseAuth } from '../../config/firebase'

export class FirebaseAuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Verify Firebase ID token and sync user with Prisma
   */
  async verifyAndSyncUser(token: string) {
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token)
      const firebaseUid = decodedToken.uid
      const email = decodedToken.email
      const name = decodedToken.name || email?.split('@')[0] || 'User'

      // Check if user exists in Prisma
      let user = await this.prisma.user.findUnique({
        where: { firebaseUid },
      })

      // If user doesn't exist, create them
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            firebaseUid,
            email: email!,
            name,
            role: 'STAFF', // Default role for new users
            isActive: true,
          },
        })
      }

      return {
        userId: user.id,
        firebaseUid,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      }
    } catch (error: any) {
      throw new Error(`Firebase token verification failed: ${error.message}`)
    }
  }

  /**
   * Get user profile from Firebase and Prisma
   */
  async getUserProfile(firebaseUid: string) {
    try {
      const firebaseUser = await firebaseAuth.getUser(firebaseUid)
      const prismaUser = await this.prisma.user.findUnique({
        where: { firebaseUid },
      })

      if (!prismaUser) {
        throw new Error('User not found in database')
      }

      return {
        ...prismaUser,
        firebaseEmail: firebaseUser.email,
        firebasePhotoUrl: firebaseUser.photoURL,
      }
    } catch (error: any) {
      throw new Error(`Failed to get user profile: ${error.message}`)
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    firebaseUid: string,
    data: { name?: string; email?: string }
  ) {
    try {
      // Update in Firebase if email is being changed
      if (data.email) {
        await firebaseAuth.updateUser(firebaseUid, { email: data.email })
      }

      // Update in Prisma
      const updateData: any = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.email !== undefined) updateData.email = data.email

      const user = await this.prisma.user.update({
        where: { firebaseUid },
        data: updateData,
      })

      return user
    } catch (error: any) {
      throw new Error(`Failed to update profile: ${error.message}`)
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          firebaseUid: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      })
      return users
    } catch (error: any) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(firebaseUid: string) {
    try {
      const user = await this.prisma.user.update({
        where: { firebaseUid },
        data: { isActive: false },
      })
      return user
    } catch (error: any) {
      throw new Error(`Failed to deactivate user: ${error.message}`)
    }
  }
}
