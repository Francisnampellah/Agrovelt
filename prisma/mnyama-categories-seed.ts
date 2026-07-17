import { PrismaClient } from '@prisma/client'

// Mirrors AMD_web_app's src/Helpers/productHelpers.js `categoryOptions` —
// the fixed list Mnyama Shop admins pick from when creating a product.
// Kept in sync manually since the two repos don't share code; if that list
// changes, update this one too. Seeding these up front means the Firestore
// catalog sync (firebase-catalog-seed.service.ts) can always resolve a
// product's plain-text `category` field to a real, stable category by name
// — which matters because Category IDs are not stable across a database
// rebuild (fresh UUIDs every time), so name matching is the durable link,
// not whatever `agrovet_catalog.category_id` a Firestore doc happens to
// carry from a previous database generation.
export const MNYAMA_SHOP_CATEGORIES = [
  'Acaricide',
  'Animal Antibiotic',
  'Animal Antiprotozoal',
  'Animal Mineral Suppliment',
  'Animal Vaccine',
  'Animal Vitamin',
  'Anti-inflammatory',
  'Antibiotic',
  'Antihelminthic',
  'Antiprotozoal',
  'Dewormer',
  'Disinfectant',
  'Drinker',
  'Feeder',
  'Fungicide',
  'Herbicide',
  'Hormone',
  'Insecticide',
  'Mineral Suppliment',
  'Other Animal Product',
  'Poultry Anthelminthics',
  'Poultry Antibiotic',
  'Poultry Anticoccidial',
  'Poultry Vaccines',
  'Poultry Vitamin & Mineral Suppliments',
  'Preservatives',
  'Public Hygiene',
  'Rodenticide',
  'Sprayer Pump',
  'Vaccinator Tools',
  'Vaccine Water Treatement'
]

export async function seedMnyamaShopCategories(prisma: PrismaClient) {
  let created = 0

  for (const name of MNYAMA_SHOP_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    })
    if (!existing) {
      await prisma.category.create({ data: { name } })
      created++
    }
  }

  console.log(
    `Mnyama Shop categories ready: ${MNYAMA_SHOP_CATEGORIES.length} total, ${created} created`
  )
}
