import { PrismaClient } from '@prisma/client'

export async function assertOrganizationAccess(
  prisma: PrismaClient,
  userId: string,
  role: string,
  organizationId: string
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId }
  })

  if (!org) {
    throw new Error('Organization not found')
  }

  if (role === 'SUPER_ADMIN') {
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, isActive: true }
  })

  if (!user?.isActive) {
    throw new Error('User account is deactivated')
  }

  if (user.organizationId !== organizationId) {
    throw new Error('Access denied to this organization')
  }
}
