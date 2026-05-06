import bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'
import { PrismaClient, Role } from '@prisma/client'

dotenv.config()

const prisma = new PrismaClient()

async function main() {
  const ADMIN_NAME = process.env.ADMIN_NAME || 'nampellah'
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bnampellah1@gmail.com'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!'
  const ORG_NAME = process.env.ADMIN_ORG_NAME || 'nampellah'

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  let organization = await prisma.organization.findFirst({
    where: { name: ORG_NAME }
  })

  if (!organization) {
    organization = await prisma.organization.create({
      data: { name: ORG_NAME }
    })
  }

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      role: Role.ADMIN,
      isActive: true,
      organizationId: organization.id,
      passwordHash
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      organizationId: organization.id
    }
  })

  console.log(`Admin user ready: ${admin.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })