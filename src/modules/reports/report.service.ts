import {
  CashFlowCategory,
  CashFlowDirection,
  InventoryTxnType,
  PaymentMethod,
  Prisma,
  PrismaClient,
  SaleStatus
} from '@prisma/client'
import { AuthActor, canGenerateBusinessReport } from '../auth/permissions'
import { ReportApiError } from './report.errors'
import { normalizeReportRequest } from './normalize'
import { resolveReportShops, ReportShopRef } from './report.scope'
import { GenerateBusinessReportRequest, NormalizedReportRequest } from './types'

type ShopFilter = { shopId: { in: string[] } }

function shopWhere(shopIds: string[]): ShopFilter {
  return { shopId: { in: shopIds } }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function periodKey(date: Date, groupBy: NormalizedReportRequest['groupBy']): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  if (groupBy === 'MONTH') return `${y}-${m}`
  if (groupBy === 'WEEK') {
    const day = startOfUtcDay(date)
    const weekStart = addUtcDays(day, -((day.getUTCDay() + 6) % 7))
    return weekStart.toISOString().slice(0, 10)
  }
  return `${y}-${m}-${d}`
}

export class BusinessReportService {
  constructor(private prisma: PrismaClient) {}

  async generate(actor: AuthActor, organizationId: string, body: GenerateBusinessReportRequest) {
    const request = normalizeReportRequest(body)
    const { shopIds, shops } = await resolveReportShops(
      this.prisma,
      actor,
      organizationId,
      request.shopIds.length ? request.shopIds : undefined
    )

    if (shopIds.length === 0) {
      throw new ReportApiError(
        'No shops available for this report scope',
        422,
        'REPORT_NO_SHOPS'
      )
    }

    const generatedAt = new Date()
    const payload = await this.buildPayload({
      actor,
      organizationId,
      request,
      shopIds,
      shops,
      generatedAt
    })

    const saved = await this.prisma.businessReport.create({
      data: {
        organizationId,
        generatedByUserId: actor.userId,
        from: request.from,
        to: request.to,
        timezone: request.timezone,
        currency: request.currency,
        shopIds,
        request: request.raw as Prisma.InputJsonValue,
        payload: payload as Prisma.InputJsonValue
      }
    })

    console.info('[business-report] generated', {
      reportId: saved.id,
      organizationId,
      userId: actor.userId,
      role: actor.role,
      shopIds,
      from: request.from.toISOString(),
      to: request.to.toISOString()
    })

    const meta = payload.meta as Record<string, unknown>
    return {
      ...payload,
      meta: {
        ...meta,
        reportId: saved.id
      }
    }
  }

  async list(actor: AuthActor, organizationId: string, take = 20) {
    if (!canGenerateBusinessReport(actor)) {
      throw new ReportApiError(
        'Insufficient permissions to generate reports',
        403,
        'REPORT_FORBIDDEN'
      )
    }

    const limit = Math.min(Math.max(take, 1), 100)
    const rows = await this.prisma.businessReport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        organizationId: true,
        from: true,
        to: true,
        timezone: true,
        currency: true,
        shopIds: true,
        createdAt: true,
        generatedByUserId: true,
        generatedBy: { select: { id: true, name: true, role: true } }
      }
    })

    return rows.map(row => ({
      reportId: row.id,
      organizationId: row.organizationId,
      from: row.from.toISOString(),
      to: row.to.toISOString(),
      timezone: row.timezone,
      currency: row.currency,
      shopIds: row.shopIds,
      generatedAt: row.createdAt.toISOString(),
      generatedBy: {
        userId: row.generatedBy.id,
        name: row.generatedBy.name,
        role: row.generatedBy.role
      }
    }))
  }

  async getById(actor: AuthActor, organizationId: string, reportId: string) {
    if (!canGenerateBusinessReport(actor)) {
      throw new ReportApiError(
        'Insufficient permissions to generate reports',
        403,
        'REPORT_FORBIDDEN'
      )
    }

    const row = await this.prisma.businessReport.findFirst({
      where: { id: reportId, organizationId }
    })
    if (!row) {
      throw new ReportApiError('Report not found', 404, 'REPORT_NOT_FOUND')
    }

    return row.payload
  }

  private async buildPayload(args: {
    actor: AuthActor
    organizationId: string
    request: NormalizedReportRequest
    shopIds: string[]
    shops: ReportShopRef[]
    generatedAt: Date
  }) {
    const { actor, organizationId, request, shopIds, shops, generatedAt } = args
    const include = request.include
    const filter = shopWhere(shopIds)
    const dateSale = { createdAt: { gte: request.from, lte: request.to } }
    const dateExpense = { date: { gte: request.from, lte: request.to } }
    const dateGeneric = { createdAt: { gte: request.from, lte: request.to } }

    const paymentMethods = request.filters.paymentMethods as PaymentMethod[] | undefined

    const [
      completedAgg,
      refundAgg,
      expenseAgg,
      purchaseAgg,
      fundingAgg,
      inventoryRows
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { ...filter, status: SaleStatus.COMPLETED, ...dateSale },
        _sum: { total: true },
        _count: { _all: true }
      }),
      this.prisma.cashFlowEntry.aggregate({
        where: {
          ...filter,
          ...dateGeneric,
          direction: CashFlowDirection.OUT,
          category: CashFlowCategory.REFUND
        },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      this.prisma.expense.aggregate({
        where: {
          ...filter,
          ...dateExpense,
          ...(request.filters.expenseCategories?.length
            ? { category: { in: request.filters.expenseCategories } }
            : {})
        },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      this.prisma.purchase.aggregate({
        where: { ...filter, ...dateGeneric },
        _sum: { totalAmount: true },
        _count: { _all: true }
      }),
      this.prisma.cashFlowEntry.aggregate({
        where: {
          ...filter,
          ...dateGeneric,
          direction: CashFlowDirection.IN,
          category: CashFlowCategory.ADJUSTMENT
        },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      include.summary || include.inventorySnapshot || include.topProducts
        ? this.prisma.inventory.findMany({
            where: filter,
            select: {
              quantity: true,
              costPrice: true,
              variantId: true,
              shopId: true,
              variant: {
                select: {
                  id: true,
                  sku: true,
                  productId: true,
                  product: { select: { id: true, name: true } }
                }
              }
            }
          })
        : Promise.resolve([])
    ])

    const revenue = completedAgg._sum.total ?? 0
    const refunds = refundAgg._sum.amount ?? 0
    const expenses = expenseAgg._sum.amount ?? 0
    const purchases = purchaseAgg._sum.totalAmount ?? 0
    const funding = fundingAgg._sum.amount ?? 0
    const cashIn = revenue + funding
    const cashOut = expenses + purchases + refunds
    const netCash = cashIn - cashOut

    const stockValue = inventoryRows.reduce((sum, row) => sum + row.quantity * row.costPrice, 0)
    const stockUnits = inventoryRows.reduce((sum, row) => sum + row.quantity, 0)
    const skuSet = new Set(inventoryRows.map(row => row.variantId))
    const zeroStockCount = inventoryRows.filter(row => row.quantity <= 0).length
    const lowStockCount = inventoryRows.filter(
      row => row.quantity > 0 && row.quantity <= request.filters.lowStockThreshold
    ).length

    const payload: Record<string, unknown> = {
      meta: {
        reportId: null,
        organizationId,
        generatedAt: generatedAt.toISOString(),
        from: request.from.toISOString(),
        to: request.to.toISOString(),
        timezone: request.timezone,
        shopIds,
        shopNames: shops,
        generatedBy: { userId: actor.userId, role: actor.role },
        currency: request.currency,
        filtersApplied: request.filters,
        knownLimitations: {
          inventorySnapshot: 'CURRENT_STOCK_ONLY',
          amounts: 'DECIMAL_TZS_FLOAT'
        }
      }
    }

    if (include.summary) {
      payload.summary = {
        revenue,
        refunds,
        expenses,
        purchases,
        funding,
        cashIn,
        cashOut,
        netCash,
        salesCount: completedAgg._count._all,
        refundCount: refundAgg._count._all,
        expenseCount: expenseAgg._count._all,
        purchaseCount: purchaseAgg._count._all,
        stockValue,
        stockUnits,
        skuCount: skuSet.size,
        zeroStockCount,
        lowStockCount
      }
    }

    if (include.cashMovement) {
      payload.cashMovement = {
        in: [
          { type: 'SALE', amount: revenue, count: completedAgg._count._all },
          { type: 'FUNDING', amount: funding, count: fundingAgg._count._all }
        ].filter(row => row.amount > 0 || row.count > 0),
        out: [
          { type: 'EXPENSE', amount: expenses, count: expenseAgg._count._all },
          { type: 'PURCHASE', amount: purchases, count: purchaseAgg._count._all },
          { type: 'REFUND', amount: refunds, count: refundAgg._count._all }
        ].filter(row => row.amount > 0 || row.count > 0)
      }
    }

    if (include.breakdownByPaymentMethod) {
      const payments = await this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          ...(paymentMethods?.length ? { method: { in: paymentMethods } } : {}),
          sale: {
            ...filter,
            status: SaleStatus.COMPLETED,
            ...dateSale
          }
        },
        _sum: { amount: true },
        _count: { _all: true }
      })
      payload.breakdowns = {
        ...(payload.breakdowns as object ?? {}),
        byPaymentMethod: payments.map(row => ({
          method: row.method,
          amount: row._sum.amount ?? 0,
          count: row._count._all
        }))
      }
    }

    if (include.breakdownByShop) {
      const byShopSales = await this.prisma.sale.groupBy({
        by: ['shopId'],
        where: { ...filter, status: SaleStatus.COMPLETED, ...dateSale },
        _sum: { total: true },
        _count: { _all: true }
      })
      const nameById = new Map(shops.map(shop => [shop.shopId, shop.name]))
      payload.breakdowns = {
        ...(payload.breakdowns as object ?? {}),
        byShop: byShopSales.map(row => ({
          shopId: row.shopId,
          shopName: nameById.get(row.shopId) ?? null,
          revenue: row._sum.total ?? 0,
          salesCount: row._count._all
        }))
      }
    }

    if (include.breakdownByCategory) {
      const byCategory = await this.prisma.expense.groupBy({
        by: ['category'],
        where: { ...filter, ...dateExpense },
        _sum: { amount: true },
        _count: { _all: true }
      })
      payload.breakdowns = {
        ...(payload.breakdowns as object ?? {}),
        byCategory: byCategory.map(row => ({
          category: row.category ?? 'UNCATEGORIZED',
          amount: row._sum.amount ?? 0,
          count: row._count._all
        }))
      }
    }

    if (include.timeline && request.groupBy !== 'NONE' && request.groupBy !== 'SHOP') {
      payload.timeline = await this.buildTimeline(shopIds, request)
    }

    if (include.topProducts) {
      payload.topProducts = await this.buildTopProducts(shopIds, request, inventoryRows)
    }

    if (include.inventorySnapshot) {
      let items = inventoryRows.map(row => ({
        shopId: row.shopId,
        variantId: row.variantId,
        productId: row.variant.productId,
        productName: row.variant.product.name,
        sku: row.variant.sku,
        quantity: row.quantity,
        costPrice: row.costPrice,
        stockValue: row.quantity * row.costPrice
      }))
      if (request.filters.onlyLowStock) {
        items = items.filter(
          item => item.quantity > 0 && item.quantity <= request.filters.lowStockThreshold
        )
      }
      payload.inventorySnapshot = {
        asOf: generatedAt.toISOString(),
        semantics: 'CURRENT_STOCK',
        items
      }
    }

    if (include.productMovements) {
      payload.productMovements = await this.buildProductMovements(shopIds, shops, request)
    }

    const transactions: Record<string, unknown> = {}
    if (include.sales) {
      transactions.sales = await this.prisma.sale.findMany({
        where: { ...filter, status: SaleStatus.COMPLETED, ...dateSale },
        select: {
          id: true,
          shopId: true,
          total: true,
          status: true,
          createdAt: true,
          payments: { select: { method: true, amount: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      })
    }
    if (include.refunds) {
      transactions.refunds = await this.prisma.cashFlowEntry.findMany({
        where: {
          ...filter,
          ...dateGeneric,
          direction: CashFlowDirection.OUT,
          category: CashFlowCategory.REFUND
        },
        select: {
          id: true,
          shopId: true,
          amount: true,
          referenceId: true,
          createdAt: true,
          note: true
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      })
    }
    if (include.expenses) {
      transactions.expenses = await this.prisma.expense.findMany({
        where: { ...filter, ...dateExpense },
        select: {
          id: true,
          shopId: true,
          title: true,
          amount: true,
          category: true,
          date: true
        },
        orderBy: { date: 'desc' },
        take: 200
      })
    }
    if (include.purchases) {
      transactions.purchases = await this.prisma.purchase.findMany({
        where: { ...filter, ...dateGeneric },
        select: {
          id: true,
          shopId: true,
          totalAmount: true,
          createdAt: true,
          supplierId: true
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      })
    }
    if (include.funding) {
      transactions.funding = await this.prisma.cashFlowEntry.findMany({
        where: {
          ...filter,
          ...dateGeneric,
          direction: CashFlowDirection.IN,
          category: CashFlowCategory.ADJUSTMENT
        },
        select: {
          id: true,
          shopId: true,
          amount: true,
          note: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      })
    }
    if (Object.keys(transactions).length > 0) {
      payload.transactions = transactions
    }

    if (include.receipts) {
      payload.receipts = await this.prisma.receipt.findMany({
        where: {
          organizationId,
          shopId: { in: shopIds },
          createdAt: { gte: request.from, lte: request.to }
        },
        select: {
          id: true,
          receiptNumber: true,
          saleId: true,
          shopId: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      })
    }

    return payload
  }

  private async buildTimeline(shopIds: string[], request: NormalizedReportRequest) {
    const filter = shopWhere(shopIds)
    const [sales, expenses, purchases, refunds] = await Promise.all([
      this.prisma.sale.findMany({
        where: { ...filter, status: SaleStatus.COMPLETED, createdAt: { gte: request.from, lte: request.to } },
        select: { createdAt: true, total: true }
      }),
      this.prisma.expense.findMany({
        where: { ...filter, date: { gte: request.from, lte: request.to } },
        select: { date: true, amount: true }
      }),
      this.prisma.purchase.findMany({
        where: { ...filter, createdAt: { gte: request.from, lte: request.to } },
        select: { createdAt: true, totalAmount: true }
      }),
      this.prisma.cashFlowEntry.findMany({
        where: {
          ...filter,
          createdAt: { gte: request.from, lte: request.to },
          direction: CashFlowDirection.OUT,
          category: CashFlowCategory.REFUND
        },
        select: { createdAt: true, amount: true }
      })
    ])

    const buckets = new Map<string, {
      periodStart: string
      periodEnd: string
      revenue: number
      expenses: number
      purchases: number
      refunds: number
      net: number
    }>()

    const ensure = (at: Date) => {
      const key = periodKey(at, request.groupBy)
      if (!buckets.has(key)) {
        let periodStart: Date
        let periodEnd: Date
        if (request.groupBy === 'MONTH') {
          periodStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1))
          periodEnd = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0, 23, 59, 59, 999))
        } else if (request.groupBy === 'WEEK') {
          periodStart = addUtcDays(startOfUtcDay(at), -((at.getUTCDay() + 6) % 7))
          periodEnd = addUtcDays(periodStart, 6)
          periodEnd.setUTCHours(23, 59, 59, 999)
        } else {
          periodStart = startOfUtcDay(at)
          periodEnd = new Date(periodStart)
          periodEnd.setUTCHours(23, 59, 59, 999)
        }
        buckets.set(key, {
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          revenue: 0,
          expenses: 0,
          purchases: 0,
          refunds: 0,
          net: 0
        })
      }
      return buckets.get(key)!
    }

    for (const sale of sales) {
      const bucket = ensure(sale.createdAt)
      bucket.revenue += sale.total
    }
    for (const expense of expenses) {
      const bucket = ensure(expense.date)
      bucket.expenses += expense.amount
    }
    for (const purchase of purchases) {
      const bucket = ensure(purchase.createdAt)
      bucket.purchases += purchase.totalAmount
    }
    for (const refund of refunds) {
      const bucket = ensure(refund.createdAt)
      bucket.refunds += refund.amount
    }

    const points = [...buckets.values()]
      .map(point => ({
        ...point,
        net: point.revenue - point.expenses - point.purchases - point.refunds
      }))
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))

    return points.slice(-request.limits.timelinePoints)
  }

  private async buildTopProducts(
    shopIds: string[],
    request: NormalizedReportRequest,
    inventoryRows: Array<{ variantId: string; quantity: number; costPrice: number }>
  ) {
    const items = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          shopId: { in: shopIds },
          status: SaleStatus.COMPLETED,
          createdAt: { gte: request.from, lte: request.to }
        },
        ...(request.filters.variantIds?.length
          ? { variantId: { in: request.filters.variantIds } }
          : {}),
        ...(request.filters.productIds?.length
          ? { variant: { productId: { in: request.filters.productIds } } }
          : {})
      },
      select: {
        variantId: true,
        quantity: true,
        price: true,
        variant: {
          select: {
            id: true,
            sku: true,
            productId: true,
            product: { select: { name: true } }
          }
        }
      }
    })

    const byVariant = new Map<string, {
      productId: string
      variantId: string
      name: string
      sku: string
      unitsSold: number
      revenue: number
    }>()

    for (const item of items) {
      const existing = byVariant.get(item.variantId) ?? {
        productId: item.variant.productId,
        variantId: item.variantId,
        name: item.variant.product.name,
        sku: item.variant.sku,
        unitsSold: 0,
        revenue: 0
      }
      existing.unitsSold += item.quantity
      existing.revenue += item.quantity * item.price
      byVariant.set(item.variantId, existing)
    }

    const stockByVariant = new Map<string, { stock: number; stockValue: number }>()
    for (const row of inventoryRows) {
      const current = stockByVariant.get(row.variantId) ?? { stock: 0, stockValue: 0 }
      current.stock += row.quantity
      current.stockValue += row.quantity * row.costPrice
      stockByVariant.set(row.variantId, current)
    }

    const ranked = [...byVariant.values()].map(row => ({
      ...row,
      stock: stockByVariant.get(row.variantId)?.stock ?? 0,
      stockValue: stockByVariant.get(row.variantId)?.stockValue ?? 0
    }))

    ranked.sort((a, b) =>
      request.sort.topProductsBy === 'UNITS'
        ? b.unitsSold - a.unitsSold
        : b.revenue - a.revenue
    )

    return ranked.slice(0, request.limits.topProducts)
  }

  private async buildProductMovements(
    shopIds: string[],
    shops: ReportShopRef[],
    request: NormalizedReportRequest
  ) {
    const allowedTypes = (request.filters.transactionTypes ?? [])
      .map(type => {
        if (type === 'SALE') return InventoryTxnType.SALE
        if (type === 'PURCHASE') return InventoryTxnType.PURCHASE
        if (type === 'ADJUSTMENT') return InventoryTxnType.ADJUSTMENT
        if (type === 'RETURN') return InventoryTxnType.RETURN
        if (type === 'TRANSFER') return InventoryTxnType.TRANSFER
        return null
      })
      .filter((type): type is InventoryTxnType => type !== null)

    const nameByShop = new Map(shops.map(shop => [shop.shopId, shop.name]))
    const rows = await this.prisma.inventoryTransaction.findMany({
      where: {
        shopId: { in: shopIds },
        createdAt: { gte: request.from, lte: request.to },
        ...(allowedTypes.length ? { type: { in: allowedTypes } } : {}),
        ...(request.filters.variantIds?.length
          ? { variantId: { in: request.filters.variantIds } }
          : {})
      },
      include: {
        variant: { select: { id: true, product: { select: { name: true } } } }
      },
      orderBy: { createdAt: request.sort.movements === 'ASC' ? 'asc' : 'desc' },
      take: request.limits.recentMovements
    })

    return rows.map(row => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      type: row.type,
      shopId: row.shopId,
      shopName: nameByShop.get(row.shopId) ?? null,
      productName: row.variant.product.name,
      variantId: row.variantId,
      quantity: row.quantity,
      amount: 0,
      referenceId: row.referenceId,
      referenceType: row.type
    }))
  }
}
