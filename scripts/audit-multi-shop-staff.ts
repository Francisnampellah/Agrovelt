import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const staffUsers = await prisma.user.findMany({
    where: { role: 'STAFF' },
    select: {
      id: true,
      name: true,
      email: true,
      organizationId: true,
      staffIn: {
        select: {
          shopId: true,
          shop: { select: { name: true } }
        }
      }
    }
  })

  const multiShopStaff = staffUsers.filter(user => user.staffIn.length > 1)

  console.log(JSON.stringify({
    totalStaff: staffUsers.length,
    multiShopCount: multiShopStaff.length,
    multiShopStaff: multiShopStaff.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      shopCount: user.staffIn.length,
      shops: user.staffIn.map(row => ({ shopId: row.shopId, name: row.shop.name }))
    }))
  }, null, 2))

  await prisma.$disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
