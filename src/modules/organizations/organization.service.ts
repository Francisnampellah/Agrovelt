import { PrismaClient, Role } from '@prisma/client'
import {
  CreateOrganizationForUserResponse,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  UpdateOrganizationSettingsRequest,
  OrganizationResponse
} from './types'

export class OrganizationService {
  constructor(private prisma: PrismaClient) {}

  async createOrganizationForUser(
    userId: string,
    data: CreateOrganizationRequest
  ): Promise<CreateOrganizationForUserResponse> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('User not found')
      }

      if (!user.isActive) {
        throw new Error('User account is deactivated')
      }

      if (user.role === Role.SUPER_ADMIN) {
        throw new Error('SUPER_ADMIN cannot be linked to an organization')
      }

      if (user.organizationId) {
        throw new Error('User already belongs to an organization')
      }

      const organization = await tx.organization.create({
        data
      })

      const linkedUser = await tx.user.update({
        where: { id: userId },
        data: {
          organizationId: organization.id,
          role: Role.OWNER
        }
      })

      return {
        organization,
        user: {
          id: linkedUser.id,
          name: linkedUser.name,
          email: linkedUser.email,
          role: linkedUser.role,
          organizationId: linkedUser.organizationId
        }
      }
    })
  }

  async getAllOrganizations(): Promise<OrganizationResponse[]> {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' }
    })
  }

  async getOrganizationById(id: string): Promise<OrganizationResponse> {
    const org = await this.prisma.organization.findUnique({
      where: { id }
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    return org
  }

  async updateOrganization(id: string, data: UpdateOrganizationRequest): Promise<OrganizationResponse> {
    const org = await this.prisma.organization.findUnique({
      where: { id }
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    return this.prisma.organization.update({
      where: { id },
      data
    })
  }

  // Deliberately narrower than updateOrganization - reachable by an org's
  // own OWNER (see OrganizationController.updateSettings), so it must only
  // ever touch fields safe for the org itself to self-serve, never
  // name/slug/email.
  async updateOrganizationSettings(
    id: string,
    data: UpdateOrganizationSettingsRequest
  ): Promise<OrganizationResponse> {
    const org = await this.prisma.organization.findUnique({
      where: { id }
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    return this.prisma.organization.update({
      where: { id },
      // Omitting the key (rather than passing `undefined` through) keeps
      // PATCH semantics correct - an absent field leaves the stored value
      // untouched, while an explicit `null` clears it.
      data: 'defaultMarkupPercent' in data ? { defaultMarkupPercent: data.defaultMarkupPercent } : {}
    })
  }
}
