import bcrypt from 'bcrypt'
import { ManagerAccess, Prisma, PrismaClient, Role } from '@prisma/client'
import { AuthActor, canManageUsers } from '../auth/permissions'
import { CreateOrgUserInput, UpdateOrgUserInput } from './types'

type UserRole = CreateOrgUserInput['role']
type Access = NonNullable<CreateOrgUserInput['managerAccess']>

const organizationUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  organizationId: true,
  managerAccess: true,
  isActive: true,
  staffIn: {
    select: {
      shopId: true,
      role: true,
      shop: { select: { id: true, name: true } }
    }
  }
} satisfies Prisma.UserSelect

export class OrgUsersService {
  constructor(private prisma: PrismaClient) {}

  async createOrgUser(actor: AuthActor, orgId: string, input: CreateOrgUserInput) {
    await this.assertCanManageUsers(actor, orgId)
    this.validateAssignment(input.role, input.managerAccess, input.shopId)
    await this.validateShop(orgId, input.shopId)

    const passwordHash = await bcrypt.hash(input.password, 10)

    return this.prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role === 'STAFF' ? Role.STAFF : Role.MANAGER,
          organizationId: orgId,
          managerAccess: input.role === 'MANAGER'
            ? input.managerAccess === 'ALL_SHOPS' ? ManagerAccess.ALL_SHOPS : ManagerAccess.ONE_SHOP
            : null
        }
      })

      if (input.shopId) {
        await tx.shopStaff.create({
          data: {
            shopId: input.shopId,
            userId: user.id,
            role: input.role
          }
        })
      }

      const publicUser = await tx.user.findUnique({
        where: { id: user.id },
        select: organizationUserSelect
      })
      if (!publicUser) throw new Error('User not found after creation')
      return publicUser
    })
  }

  async listOrgUsers(actor: AuthActor, orgId: string) {
    await this.assertCanManageUsers(actor, orgId)

    return this.prisma.user.findMany({
      where: { organizationId: orgId },
      select: organizationUserSelect
    })
  }

  async updateOrgUser(actor: AuthActor, orgId: string, userId: string, input: UpdateOrgUserInput) {
    await this.assertCanManageUsers(actor, orgId)

    const existing = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
      include: { staffIn: { select: { shopId: true } } }
    })
    if (!existing) throw new Error('User not found in this organization')
    if (existing.role !== Role.STAFF && existing.role !== Role.MANAGER) {
      throw new Error('Only STAFF and MANAGER users can be updated by this service')
    }

    const role = input.role ?? existing.role
    const managerAccess = role === Role.MANAGER
      ? input.managerAccess ?? (existing.role === Role.MANAGER ? existing.managerAccess : undefined)
      : input.managerAccess
    const shopId = managerAccess === ManagerAccess.ALL_SHOPS
      ? input.shopId
      : input.shopId ?? existing.staffIn[0]?.shopId
    this.validateAssignment(role, managerAccess, shopId)
    await this.validateShop(orgId, shopId)

    const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined

    return this.prisma.$transaction(async tx => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.email !== undefined && { email: input.email }),
          ...(passwordHash !== undefined && { passwordHash }),
          role: role === 'STAFF' ? Role.STAFF : Role.MANAGER,
          managerAccess: role === 'MANAGER'
            ? managerAccess === 'ALL_SHOPS' ? ManagerAccess.ALL_SHOPS : ManagerAccess.ONE_SHOP
            : null
        }
      })

      await tx.shopStaff.deleteMany({ where: { userId } })
      if (shopId) {
        await tx.shopStaff.create({
          data: {
            shopId,
            userId,
            role
          }
        })
      }

      const publicUser = await tx.user.findUnique({
        where: { id: user.id },
        select: organizationUserSelect
      })
      if (!publicUser) throw new Error('User not found after update')
      return publicUser
    })
  }

  async deactivateOrgUser(actor: AuthActor, orgId: string, userId: string) {
    await this.assertCanManageUsers(actor, orgId)

    const existing = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId }
    })
    if (!existing) throw new Error('User not found in this organization')

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: organizationUserSelect
    })
  }

  private async assertCanManageUsers(actor: AuthActor, orgId: string): Promise<void> {
    if (!canManageUsers(actor)) {
      throw new Error('Insufficient permissions for user management')
    }
    if (actor.role === 'OWNER' && actor.organizationId !== orgId) {
      throw new Error('Access denied to this organization')
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true }
    })
    if (!org) {
      throw new Error('Organization not found')
    }
  }

  private validateAssignment(role: UserRole, managerAccess: Access | null | undefined, shopId?: string): void {
    if (role === 'STAFF') {
      if (!shopId) throw new Error('shopId is required for STAFF')
      if (managerAccess) throw new Error('managerAccess is not allowed for STAFF')
      return
    }

    if (!managerAccess) throw new Error('managerAccess is required for MANAGER')
    if (managerAccess === 'ONE_SHOP' && !shopId) {
      throw new Error('shopId is required for ONE_SHOP managers')
    }
    if (managerAccess === 'ALL_SHOPS' && shopId) {
      throw new Error('shopId is not allowed for ALL_SHOPS managers')
    }
  }

  private async validateShop(orgId: string, shopId?: string): Promise<void> {
    if (!shopId) return

    const shop = await this.prisma.shop.findFirst({
      where: { id: shopId, organizationId: orgId }
    })
    if (!shop) throw new Error('Shop not found in this organization')
  }
}
