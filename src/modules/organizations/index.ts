import { PrismaClient } from '@prisma/client'
import { OrganizationService } from './organization.service'
import { OrganizationController } from './organization.controller'

export function createOrganizationModule(prisma: PrismaClient) {
  const organizationService = new OrganizationService(prisma)
  const organizationController = new OrganizationController(organizationService)

  return {
    organizationService,
    organizationController
  }
}

export { OrganizationService, OrganizationController }
export * from './types'
export * from './organization.swagger'
