import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { seedProductsFromFirebase } from '../src/modules/products/firebase-catalog-seed.service'

/**
 * Seed Mnyama Shop products from Firestore (afya-mnyama-digital / products).
 *
 * Requires FIREBASE_API_KEY (or MNYAMA_SHOP_FIREBASE_API_KEY) to read Firestore.
 * Products must include `agrovet_catalog.variant_id` (used as ProductVariant.id).
 *
 * Usage:
 *   npm run seed:firebase-products:dry-run
 *   npm run seed:firebase-products
 *
 * Env:
 *   FIREBASE_PRODUCTS_COLLECTION=products   (default)
 *   FIREBASE_PUBLISHED_ONLY=true            (default, matches mobile app query)
 */
async function main() {
  const prisma = new PrismaClient()

  const dryRun = process.argv.includes('--dry-run')
  const productsCollection = process.env.FIREBASE_PRODUCTS_COLLECTION ?? 'products'
  const publishedOnly = process.env.FIREBASE_PUBLISHED_ONLY !== 'false'

  try {
    const result = await seedProductsFromFirebase(prisma, {
      productsCollection,
      publishedOnly,
      dryRun
    })

    console.log('Mnyama Shop Firebase product seed complete')
    console.log(JSON.stringify(result, null, 2))

    if (result.errors.length > 0) {
      process.exitCode = 1
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
