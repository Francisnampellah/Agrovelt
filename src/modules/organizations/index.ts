import { PrismaClient } from '@prisma/client'
import { AuthService } from '../auth/auth.service'
import { OrganizationService } from './organization.service'
import { OrganizationController } from './organization.controller'

export function createOrganizationModule(prisma: PrismaClient) {
  const authService = new AuthService(prisma)
  const organizationService = new OrganizationService(prisma)
  const organizationController = new OrganizationController(organizationService, authService)

  return {
    organizationService,
    organizationController
  }
}

export { OrganizationService, OrganizationController }
export * from './types'
export * from './organization.swagger'
