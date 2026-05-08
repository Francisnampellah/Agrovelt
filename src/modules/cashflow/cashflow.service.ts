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

    const totalIn  = entries.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amount, 0)
    const totalOut = entries.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amount, 0)
    
    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      breakdown: this.groupByCategory(entries)
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
    const { direction, category, from, to, cursor, take = 50 } = filters
    return this.prisma.cashFlowEntry.findMany({
      where: {
        shopId,
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