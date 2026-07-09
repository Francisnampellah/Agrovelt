import { PrismaClient, Prisma, CashFlowEntry, CashFlowDirection, CashFlowCategory } from '@prisma/client'

export class CashFlowService {
  constructor(private prisma: PrismaClient) {}

  // Internal — called within transactions by other services
  async record(
    tx: Prisma.TransactionClient,
    data: {
      shopId: string
      direction: CashFlowDirection
      category: CashFlowCategory
      amount: number
      referenceId?: string
      note?: string
      recordedBy: string
    }
  ) {
    await tx.cashFlowEntry.create({ data })
  }

  // Public — queried by reports and dashboards
  async getSummary(shopId: string, from: Date, to: Date) {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: { shopId, createdAt: { gte: from, lte: to } }
    })

    return this.summarize(entries)
  }

  // Category-level rollup across every shop in the organization (or a
  // specific subset of shops, for shop-filtered reports) — distinct from
  // getSummary's IN/OUT split, since the Finance hub needs revenue vs
  // expenses vs purchases vs refunds broken out individually.
  async getFinanceSummaryByOrganization(
    organizationId: string,
    from: Date,
    to: Date,
    shopIds?: string[]
  ) {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: {
        shop: { organizationId, ...(shopIds?.length ? { id: { in: shopIds } } : {}) },
        createdAt: { gte: from, lte: to }
      }
    })

    const sumBy = (category: CashFlowCategory) =>
      entries.filter(e => e.category === category).reduce((s, e) => s + e.amount, 0)
    const countBy = (category: CashFlowCategory) =>
      entries.filter(e => e.category === category).length

    const totalRevenue = sumBy('SALE')
    const totalExpenses = sumBy('EXPENSE')
    const totalPurchases = sumBy('PURCHASE')
    const totalRefunds = sumBy('REFUND')

    return {
      totalRevenue,
      salesCount: countBy('SALE'),
      totalExpenses,
      expenseCount: countBy('EXPENSE'),
      totalPurchases,
      purchaseCount: countBy('PURCHASE'),
      totalRefunds,
      refundCount: countBy('REFUND'),
      // Refunds are recorded as their own OUT entry (not a reversal of the
      // original SALE entry), so they must be subtracted here explicitly —
      // otherwise a fully-refunded shop shows inflated revenue and net income.
      netEstimate: totalRevenue - totalExpenses - totalPurchases - totalRefunds
    }
  }

  async getEntries(shopId: string, filters: {
    direction?: 'IN' | 'OUT'
    category?: CashFlowCategory
    from?: Date
    to?: Date
    cursor?: string
    take?: number
  }) {
    return this.queryEntries({ shopId }, filters)
  }

  // Org-wide activity feed for the Finance hub — spans every shop (or a
  // specific subset, for shop-filtered reports), so each entry includes
  // its shop so the UI can show which shop it came from.
  async getEntriesByOrganization(organizationId: string, filters: {
    from?: Date
    to?: Date
    shopIds?: string[]
    cursor?: string
    take?: number
  } = {}) {
    const { from, to, shopIds, cursor, take = 50 } = filters
    return this.prisma.cashFlowEntry.findMany({
      where: {
        shop: { organizationId, ...(shopIds?.length ? { id: { in: shopIds } } : {}) },
        ...(from || to ? {
          createdAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to })
          }
        } : {})
      },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: { shop: { select: { id: true, name: true } } }
    })
  }

  private async queryEntries(scope: { shopId: string } | { shop: { organizationId: string } }, filters: {
    direction?: 'IN' | 'OUT'
    category?: CashFlowCategory
    from?: Date
    to?: Date
    cursor?: string
    take?: number
  }) {
    const { direction, category, from, to, cursor, take = 50 } = filters
    return this.prisma.cashFlowEntry.findMany({
      where: {
        ...scope,
        ...(direction && { direction }),
        ...(category && { category }),
        ...(from || to ? {
          createdAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to })
          }
        } : {})
      },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' }
    })
  }

  private summarize(entries: CashFlowEntry[]) {
    const totalIn  = entries.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amount, 0)
    const totalOut = entries.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amount, 0)

    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      breakdown: this.groupByCategory(entries)
    }
  }

  private groupByCategory(entries: CashFlowEntry[]) {
    return entries.reduce((acc, entry) => {
      const cat = entry.category
      if (!acc[cat]) acc[cat] = { in: 0, out: 0 }
      if (entry.direction === 'IN') acc[cat].in += entry.amount
      else acc[cat].out += entry.amount
      return acc
    }, {} as Record<string, { in: number; out: number }>)
  }
}