import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { fetchMnyamaShopPublishedProducts } from '../src/modules/products/mnyama-shop-firestore.client'
import { parseAgrovetCatalog } from '../src/modules/products/firebase-catalog-seed.service'

async function main() {
  const prisma = new PrismaClient()
  const docs = await fetchMnyamaShopPublishedProducts()

  let matched = 0
  let mismatched = 0
  let missing = 0
  const samples: string[] = []

  for (const doc of docs) {
    const catalog = parseAgrovetCatalog(doc.data)
    if (!catalog) continue

    const expectedVariantId = catalog.defaultVariantId
    const byId = await prisma.productVariant.findUnique({
      where: { id: expectedVariantId },
      select: { id: true, sku: true }
    })

    if (byId) {
      matched++
      continue
    }

    const sku = `MNYAMA-${doc.id}`
    const bySku = await prisma.productVariant.findUnique({
      where: { sku },
      select: { id: true, sku: true }
    })

    if (!bySku) {
      missing++
      if (samples.length < 3) {
        samples.push(`${doc.id}: expected ${expectedVariantId}, not in DB`)
      }
      continue
    }

    mismatched++
    if (samples.length < 5) {
      samples.push(
        `${doc.id}: firestore variant_id=${expectedVariantId}, postgres id=${bySku.id}, sku=${bySku.sku}`
      )
    }
  }

  console.log(JSON.stringify({ docs: docs.length, matched, mismatched, missing, samples }, null, 2))

  const sample = docs[0]
  if (sample) {
    const catalog = parseAgrovetCatalog(sample.data)!
    const variant = await prisma.productVariant.findUnique({
      where: { id: catalog.defaultVariantId },
      include: { product: { select: { id: true, name: true } } }
    })
    const firestoreProductId = (sample.data.agrovet_catalog as Record<string, unknown> | undefined)?.product_id
    console.log('Sample mapping:', JSON.stringify({
      firestoreDocId: sample.id,
      firestoreAgrovetCatalogVariantId: catalog.defaultVariantId,
      firestoreAgrovetCatalogProductId: firestoreProductId,
      postgresProductId: variant?.product?.id,
      postgresVariantId: variant?.id,
      postgresSku: variant?.sku,
      variantIdMatchesFirestore: variant?.id === catalog.defaultVariantId
    }, null, 2))
  }

  await prisma.$disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
