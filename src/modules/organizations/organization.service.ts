import { PrismaClient } from '@prisma/client'
import { CreateOrganizationRequest, UpdateOrganizationRequest, OrganizationResponse } from './types'

export class OrganizationService {
  constructor(private prisma: PrismaClient) {}

  async createOrganization(data: CreateOrganizationRequest): Promise<OrganizationResponse> {
    return this.prisma.organization.create({
      data
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
}
