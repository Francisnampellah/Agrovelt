import bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'
import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const ADMIN_NAME = process.env.ADMIN_NAME || 'nampellah'
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bnampellah1@gmail.com'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!'
  const ORG_NAME = process.env.ADMIN_ORG_NAME || 'nampellah'

  if (!ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAIL is required')
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  let organization = await prisma.organization.findFirst({
    where: { name: ORG_NAME }
  })

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: ORG_NAME
      }
    })
    console.log(`Created organization: ${organization.name}`)
  } else {
    console.log(`Using existing organization: ${organization.name}`)
  }

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      role: Role.ADMIN,
      isActive: true,
      organization: { connect: { id: organization.id } },
      passwordHash
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      organization: { connect: { id: organization.id } }
    }
  })

  console.log(`Admin user ready: ${admin.email}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
