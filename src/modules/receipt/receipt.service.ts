import { Prisma, PrismaClient, ReceiptStatus } from '@prisma/client'
import { CreateReceiptInput, ReceiptListFilters } from './types'

type TxClient = Prisma.TransactionClient

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
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')

    const count = await db.receipt.count({
      where: {
        organizationId,
        createdAt: { gte: start, lte: end }
      }
    })

    return `RCP-${datePart}-${String(count + 1).padStart(4, '0')}`
  }

  async createForSale(input: CreateReceiptInput, tx?: TxClient) {
    const db = this.db(tx)
    const receiptNumber = await this.generateReceiptNumber(input.organizationId, tx)

    return db.receipt.create({
      data: {
        receiptNumber,
        saleId: input.saleId,
        organizationId: input.organizationId,
        shopId: input.shopId,
        issuedBy: input.issuedBy,
        ...(input.notes !== undefined ? { notes: input.notes } : {})
      }
    })
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
