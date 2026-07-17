import { PrismaClient } from '@prisma/client'
import { BusinessReportService } from './report.service'
import { BusinessReportController } from './report.controller'

export function createReportsModule(prisma: PrismaClient) {
  const reportService = new BusinessReportService(prisma)
  const reportController = new BusinessReportController(reportService, prisma)
  return { reportService, reportController }
}

export { BusinessReportService } from './report.service'
export { BusinessReportController } from './report.controller'
export * from './types'
export * from './report.errors'
export * from './report.swagger'
