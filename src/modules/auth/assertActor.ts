import { PrismaClient } from '@prisma/client'
import { AuthActor } from './permissions'
import { AuthenticatedRequest } from './types'

export async function loadAuthActor(
  prisma: PrismaClient,
  req: AuthenticatedRequest
): Promise<AuthActor> {
  if (!req.user) throw new Error('Authentication required')

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true, organizationId: true, managerAccess: true, isActive: true }
  })

  if (!user?.isActive) throw new Error('User account is deactivated')

  return {
    userId: req.user.userId,
    role: user.role,
    organizationId: user.organizationId,
    ...(user.managerAccess ? { managerAccess: user.managerAccess } : {})
  }
}
