import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  const mnyama = await prisma.productVariant.count({ where: { sku: { startsWith: 'MNYAMA-' } } })
  const mshop = await prisma.productVariant.count({ where: { sku: { startsWith: 'MSHOP-' } } })
  const agv = await prisma.productVariant.count({ where: { sku: { startsWith: 'AGV-' } } })
  const total = await prisma.productVariant.count()

  const legacy = await prisma.productVariant.findMany({
    where: { sku: { startsWith: 'MSHOP-' } },
    take: 3,
    select: { id: true, sku: true, name: true }
  })

  console.log(JSON.stringify({ total, mnyama, mshop, agv, legacySamples: legacy }, null, 2))
  await prisma.$disconnect()
}

main()
