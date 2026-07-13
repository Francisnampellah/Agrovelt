import { PrismaClient } from '@prisma/client'
import { AuthActor } from './permissions'

export type ShopScopeResult = {
  allShops: boolean
  shopIds: string[]
  shops: { shopId: string; name: string }[]
}

type Db = PrismaClient | any

export async function resolveShopScope(prisma: Db, actor: AuthActor): Promise<ShopScopeResult> {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') {
    return { allShops: true, shopIds: [], shops: [] }
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      role: true,
      organizationId: true,
      managerAccess: true,
      shopsOwned: { select: { id: true, name: true } },
      staffIn: { select: { shop: { select: { id: true, name: true } } }
      }
    }
  })
  if (!user) throw new Error('User not found')

  const allShopsAccess =
    user.role === 'OWNER' ||
    (user.role === 'MANAGER' && user.managerAccess === 'ALL_SHOPS')

  if (allShopsAccess) {
    if (!user.organizationId) {
      return { allShops: true, shopIds: [], shops: [] }
    }

    const orgShops = await prisma.shop.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    return {
      allShops: true,
      shopIds: orgShops.map((shop: { id: string }) => shop.id),
      shops: orgShops.map((shop: { id: string; name: string }) => ({
        shopId: shop.id,
        name: shop.name
      }))
    }
  }

  const fromStaff = user.staffIn.map((staff: { shop: { id: string; name: string } }) => ({
    shopId: staff.shop.id,
    name: staff.shop.name
  }))
  const fromOwned = user.shopsOwned.map((shop: { id: string; name: string }) => ({
    shopId: shop.id,
    name: shop.name
  }))
  const uniqueShops = new Map<string, { shopId: string; name: string }>()
  for (const shop of [...fromOwned, ...fromStaff]) uniqueShops.set(shop.shopId, shop)

  const shops = [...uniqueShops.values()]
  return { allShops: false, shopIds: shops.map(shop => shop.shopId), shops }
}

export async function assertShopInScope(prisma: Db, actor: AuthActor, shopId: string): Promise<void> {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') return

  const scope = await resolveShopScope(prisma, actor)
  if (scope.allShops) {
    const [user, shop] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actor.userId },
        select: { organizationId: true }
      }),
      prisma.shop.findUnique({
        where: { id: shopId },
        select: { organizationId: true }
      })
    ])

    if (user?.organizationId && shop?.organizationId === user.organizationId) return
    throw new Error('Access denied to this shop')
  }

  if (!scope.shopIds.includes(shopId)) {
    throw new Error('Access denied to this shop')
  }
}
