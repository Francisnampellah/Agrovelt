import { PrismaClient } from '@prisma/client'
import { AuthActor, canGenerateBusinessReport } from '../auth/permissions'
import { resolveShopScope } from '../auth/shopScope'
import { ReportApiError } from './report.errors'

export type ReportShopRef = { shopId: string; name: string }

export async function resolveReportShops(
  prisma: PrismaClient,
  actor: AuthActor,
  organizationId: string,
  requestedShopIds?: string[]
): Promise<{ shopIds: string[]; shops: ReportShopRef[] }> {
  if (!canGenerateBusinessReport(actor)) {
    throw new ReportApiError(
      'Insufficient permissions to generate reports',
      403,
      'REPORT_FORBIDDEN'
    )
  }

  let allowed: ReportShopRef[]

  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') {
    const orgShops = await prisma.shop.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
    allowed = orgShops.map(shop => ({ shopId: shop.id, name: shop.name }))
  } else {
    const scope = await resolveShopScope(prisma, actor)
    if (scope.allShops) {
      const orgShops = await prisma.shop.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      })
      allowed = orgShops.map(shop => ({ shopId: shop.id, name: shop.name }))
    } else {
      const orgShopRows = await prisma.shop.findMany({
        where: { organizationId, id: { in: scope.shopIds } },
        select: { id: true, name: true }
      })
      const nameById = new Map(orgShopRows.map(shop => [shop.id, shop.name]))
      allowed = scope.shopIds
        .filter(id => nameById.has(id))
        .map(id => ({ shopId: id, name: nameById.get(id)! }))
    }
  }

  if (!requestedShopIds || requestedShopIds.length === 0) {
    return { shopIds: allowed.map(shop => shop.shopId), shops: allowed }
  }

  const allowedSet = new Set(allowed.map(shop => shop.shopId))
  const outOfScope = requestedShopIds.filter(id => !allowedSet.has(id))
  if (outOfScope.length > 0) {
    throw new ReportApiError(
      'One or more shops are outside your report scope',
      403,
      'REPORT_SHOP_OUT_OF_SCOPE',
      { shopIds: outOfScope }
    )
  }

  const requestedSet = new Set(requestedShopIds)
  const shops = allowed.filter(shop => requestedSet.has(shop.shopId))
  return { shopIds: shops.map(shop => shop.shopId), shops }
}
