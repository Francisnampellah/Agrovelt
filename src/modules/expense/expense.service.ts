import { PrismaClient, CashFlowCategory, CashFlowDirection } from '@prisma/client'
import { CashFlowService } from '../cashflow/cashflow.service'

export interface CreateExpenseRequest {
  shopId: string
  title: string
  amount: number
  category?: string
  date: Date
  recordedBy: string
}

export class ExpenseService {
  constructor(
    private prisma: PrismaClient,
    private cashFlowService: CashFlowService
  ) {}

  async createExpense(data: CreateExpenseRequest) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          shopId: data.shopId,
          title: data.title,
          amount: data.amount,
          category: data.category,
          date: data.date
        }
      })

      await this.cashFlowService.record(tx, {
        shopId: data.shopId,
        direction: CashFlowDirection.OUT,
        category: CashFlowCategory.EXPENSE,
        amount: data.amount,
        referenceId: expense.id,
        note: data.title,
        recordedBy: data.recordedBy
      })

      return expense
    })
  }

  async getExpensesByShop(shopId: string) {
    return this.prisma.expense.findMany({
      where: { shopId },
      orderBy: { date: 'desc' }
    })
  }
}