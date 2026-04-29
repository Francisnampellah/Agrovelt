import { PrismaClient } from '@prisma/client'
import { CreateShopRequest, UpdateShopRequest, ShopResponse } from './types'

export class ShopService {
  constructor(private prisma: PrismaClient) {}

  async createShop(data: CreateShopRequest): Promise<ShopResponse> {
    const { name, location, ownerId } = data

    // Check if owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId }
    })

    if (!owner) {
      throw new Error('Owner not found')
    }

    const shop = await this.prisma.shop.create({
      data: {
        name,
        location,
        ownerId
      }
    })

    return shop
  }

  async getAllShops(): Promise<ShopResponse[]> {
    return this.prisma.shop.findMany({
      orderBy: { createdAt: 'desc' }
    })
  }

  async getShopById(id: string): Promise<ShopResponse> {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        staff: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!shop) {
      throw new Error('Shop not found')
    }

    return shop as any // Using any for now due to include
  }

  async updateShop(id: string, data: UpdateShopRequest): Promise<ShopResponse> {
    const shop = await this.prisma.shop.findUnique({
      where: { id }
    })

    if (!shop) {
      throw new Error('Shop not found')
    }

    return this.prisma.shop.update({
      where: { id },
      data
    })
  }

  async deleteShop(id: string): Promise<void> {
    const shop = await this.prisma.shop.findUnique({
      where: { id }
    })

    if (!shop) {
      throw new Error('Shop not found')
    }

    await this.prisma.shop.delete({
      where: { id }
    })
  }

  async getShopsByOwner(ownerId: string): Promise<ShopResponse[]> {
    return this.prisma.shop.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' }
    })
  }
}
