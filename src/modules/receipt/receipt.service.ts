import { Prisma, PrismaClient, ReceiptStatus } from '@prisma/client'
import { CreateReceiptInput, ReceiptListFilters } from './types'

type TxClient = Prisma.TransactionClient
const MAX_RECEIPT_CREATE_RETRIES = 3

interface ReceiptCounterRow {
  lastValue: number
}

interface PrismaKnownRequestErrorLike {
  code?: string
  meta?: {
    target?: unknown
  }
}

export class ReceiptService {
  constructor(private prisma: PrismaClient) {}

  private db(tx?: TxClient): TxClient | PrismaClient {
    return tx ?? this.prisma
  }

  private async generateReceiptNumber(
    organizationId: string,
    tx?: TxClient
  ): Promise<string> {
    const db = this.db(tx)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const dateKey = `${year}${month}${day}`

    const [counter] = await db.$queryRaw<ReceiptCounterRow[]>`
      INSERT INTO "ReceiptCounter" ("organizationId", "dateKey", "lastValue", "createdAt", "updatedAt")
      VALUES (${organizationId}, ${dateKey}, 1, NOW(), NOW())
      ON CONFLICT ("organizationId", "dateKey")
      DO UPDATE SET
        "lastValue" = "ReceiptCounter"."lastValue" + 1,
        "updatedAt" = NOW()
      RETURNING "lastValue"
    `

    if (!counter) {
      throw new Error('Failed to allocate receipt number')
    }

    return `RCP-${dateKey}-${String(counter.lastValue).padStart(4, '0')}`
  }

  private isReceiptNumberUniqueError(error: unknown): boolean {
    const prismaError = error as PrismaKnownRequestErrorLike

    return (
      prismaError?.code === 'P2002' &&
      Array.isArray(prismaError.meta?.target) &&
      prismaError.meta.target.includes('receiptNumber')
    )
  }

  async createForSale(input: CreateReceiptInput, tx?: TxClient) {
    const db = this.db(tx)

    for (let attempt = 1; attempt <= MAX_RECEIPT_CREATE_RETRIES; attempt += 1) {
      const receiptNumber = await this.generateReceiptNumber(input.organizationId, tx)

      try {
        return await db.receipt.create({
          data: {
            receiptNumber,
            saleId: input.saleId,
            organizationId: input.organizationId,
            shopId: input.shopId,
            issuedBy: input.issuedBy,
            ...(input.notes !== undefined ? { notes: input.notes } : {})
          }
        })
      } catch (error) {
        if (!this.isReceiptNumberUniqueError(error) || attempt === MAX_RECEIPT_CREATE_RETRIES) {
          throw error
        }
      }
    }

    throw new Error('Failed to create receipt')
  }

  async voidForSale(saleId: string, tx?: TxClient) {
    const db = this.db(tx)

    const receipt = await db.receipt.findUnique({ where: { saleId } })
    if (!receipt || receipt.status === ReceiptStatus.VOIDED) {
      return receipt
    }

    return db.receipt.update({
      where: { saleId },
      data: { status: ReceiptStatus.VOIDED }
    })
  }

  async getReceiptById(receiptId: string) {
    return this.getReceiptDetail(receiptId)
  }

  async getReceiptByNumber(receiptNumber: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { receiptNumber }
    })

    if (!receipt) {
      throw new Error('Receipt not found')
    }

    return this.getReceiptDetail(receipt.id)
  }

  async getReceiptDetail(receiptId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        shop: { select: { id: true, name: true, location: true, type: true } },
        organization: {
          select: { id: true, name: true, email: true, phoneNumber: true }
        },
        sale: {
          include: {
            items: {
              include: {
                variant: { include: { product: true } }
              }
            },
            payments: true
          }
        }
      }
    })

    if (!receipt) {
      throw new Error('Receipt not found')
    }

    return receipt
  }

  async getReceiptsByShop(shopId: string, filters: ReceiptListFilters = {}) {
    return this.prisma.receipt.findMany({
      where: {
        shopId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {})
              }
            }
          : {})
      },
      include: {
        shop: { select: { id: true, name: true } },
        sale: { select: { id: true, total: true, status: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getReceiptsByOrganization(organizationId: string, filters: ReceiptListFilters = {}) {
    return this.prisma.receipt.findMany({
      where: {
        organizationId,
        ...(filters.shopId ? { shopId: filters.shopId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {})
              }
            }
          : {})
      },
      include: {
        shop: { select: { id: true, name: true } },
        sale: { select: { id: true, total: true, status: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async markPrinted(receiptId: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id: receiptId } })
    if (!receipt) {
      throw new Error('Receipt not found')
    }

    if (receipt.status === ReceiptStatus.VOIDED) {
      throw new Error('Cannot print a voided receipt')
    }

    return this.prisma.receipt.update({
      where: { id: receiptId },
      data: { printedAt: new Date() }
    })
  }

  async voidReceipt(receiptId: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id: receiptId } })
    if (!receipt) {
      throw new Error('Receipt not found')
    }

    if (receipt.status === ReceiptStatus.VOIDED) {
      throw new Error('Receipt is already voided')
    }

    return this.prisma.receipt.update({
      where: { id: receiptId },
      data: { status: ReceiptStatus.VOIDED }
    })
  }
}
