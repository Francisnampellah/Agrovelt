import { PrismaClient } from '@prisma/client'
import {
  fetchMnyamaShopPublishedProducts,
  type MnyamaShopFirestoreDoc
} from './mnyama-shop-firestore.client'

export type FirebaseCatalogSeedOptions = {
  dryRun?: boolean
  productsCollection?: string
  publishedOnly?: boolean
}

export type FirebaseCatalogSeedResult = {
  fetched: number
  productsCreated: number
  productsUpdated: number
  variantsCreated: number
  variantsUpdated: number
  skipped: number
  skippedNoAgrovetCatalog: number
  errors: string[]
}

/**
 * Linked IDs on Firestore `products/{id}.agrovet_catalog`.
 * `productId`        -> Postgres Product.id (when present)
 * `defaultVariantId` -> Postgres ProductVariant.id for the product's
 *                       primary/default variant (required — a product with
 *                       no variants was never actually synced to Agrovet)
 */
export type AgrovetCatalogLink = {
  categoryId?: string
  productId?: string
  defaultVariantId: string
  syncStatus?: string
  syncedAt?: string
}

export type MnyamaShopFirebaseVariant = {
  variantId: string
  sku: string
  name: string
  defaultSellingPrice: number
  defaultCostPrice: number
}

export type MnyamaShopFirebaseProduct = {
  firebaseDocId: string
  agrovetCatalog: AgrovetCatalogLink
  name: string
  description: string
  categoryName?: string
  imageUrl?: string
  // Every variant on the Firestore doc, not just the default one — a
  // product can have several (e.g. "500ml" and "1L"), and all of them
  // need to exist in Postgres, not just the one agrovet_catalog points at.
  variants: MnyamaShopFirebaseVariant[]
}

type ProductDoc = MnyamaShopFirestoreDoc

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined
  for (const item of images) {
    const url = asString(item)
    if (url) return url
  }
  return undefined
}

export function parseAgrovetCatalog(data: Record<string, unknown>): AgrovetCatalogLink | null {
  const raw = data.agrovet_catalog
  if (!raw || typeof raw !== 'object') return null

  const catalog = raw as Record<string, unknown>
  const defaultVariantId = asString(catalog.default_variant_id)

  if (!defaultVariantId || !isUuid(defaultVariantId)) return null

  const link: AgrovetCatalogLink = { defaultVariantId }

  const productId = asString(catalog.product_id)
  if (productId && isUuid(productId)) {
    link.productId = productId
  }

  const categoryId = asString(catalog.category_id)
  if (categoryId && isUuid(categoryId)) {
    link.categoryId = categoryId
  }

  const syncStatus = asString(catalog.sync_status)
  if (syncStatus) link.syncStatus = syncStatus

  const syncedAt = asString(catalog.synced_at)
  if (syncedAt) link.syncedAt = syncedAt

  return link
}

function mapVariant(raw: unknown): MnyamaShopFirebaseVariant | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>

  const variantId = asString(data.variant_id)
  const sku = asString(data.sku)
  const name = asString(data.name)
  if (!variantId || !isUuid(variantId) || !sku || !name) return null

  const sellingPrice =
    asNumber(data.default_selling_price) ?? asNumber(data.base_price_constant) ?? 0
  const costPrice = asNumber(data.default_cost_price) ?? sellingPrice

  return {
    variantId,
    sku,
    name,
    defaultSellingPrice: sellingPrice,
    defaultCostPrice: costPrice
  }
}

export function mapMnyamaShopProduct(doc: ProductDoc): MnyamaShopFirebaseProduct | null {
  const name = asString(doc.data.name)
  if (!name) return null

  const agrovetCatalog = parseAgrovetCatalog(doc.data)
  if (!agrovetCatalog) return null

  const variants = (Array.isArray(doc.data.variants) ? doc.data.variants : [])
    .map(mapVariant)
    .filter((v): v is MnyamaShopFirebaseVariant => v !== null)

  // No variants means nothing to sync, even though agrovet_catalog is
  // present — treat it the same as "not linked" rather than creating a
  // product with zero variants.
  if (variants.length === 0) return null

  return {
    firebaseDocId: doc.id,
    agrovetCatalog,
    name,
    description: asString(doc.data.description_text) ?? '',
    ...(asString(doc.data.category) ? { categoryName: asString(doc.data.category)! } : {}),
    ...(firstImageUrl(doc.data.images) ? { imageUrl: firstImageUrl(doc.data.images)! } : {}),
    variants
  }
}

async function loadProductDocuments(
  productsCollection: string,
  publishedOnly: boolean
): Promise<ProductDoc[]> {
  if (publishedOnly && productsCollection === 'products') {
    return fetchMnyamaShopPublishedProducts()
  }

  const { getMnyamaShopFirestore } = await import('../../config/mnyama-shop-firebase')
  const firestore = getMnyamaShopFirestore()
  const snapshot = await firestore.collection(productsCollection).get()

  return snapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data() as Record<string, unknown>
  }))
}

async function resolveCategoryId(
  prisma: PrismaClient,
  agrovetCatalog: AgrovetCatalogLink,
  categoryName: string | undefined
): Promise<string | undefined> {
  if (agrovetCatalog.categoryId) {
    const byId = await prisma.category.findUnique({
      where: { id: agrovetCatalog.categoryId },
      select: { id: true }
    })
    if (byId) return byId.id
  }

  if (!categoryName) return undefined

  // Name match is the durable link — category_id above can go stale across
  // a database rebuild (fresh UUIDs each time), but a category name like
  // "Animal Vaccine" is stable as long as it's pre-seeded.
  const existing = await prisma.category.findFirst({
    where: { name: { equals: categoryName, mode: 'insensitive' } },
    select: { id: true }
  })
  if (existing) return existing.id

  const created = await prisma.category.create({
    data: { name: categoryName },
    select: { id: true }
  })
  return created.id
}

type UpsertOutcome = {
  productCreated: boolean
  variantsCreated: number
  variantsUpdated: number
}

async function resolveProductId(
  prisma: PrismaClient,
  mapped: MnyamaShopFirebaseProduct,
  categoryId: string | undefined
): Promise<{ productId: string; productCreated: boolean }> {
  const { defaultVariantId, productId: catalogProductId } = mapped.agrovetCatalog

  const existingVariant = await prisma.productVariant.findUnique({
    where: { id: defaultVariantId },
    select: { productId: true }
  })
  if (existingVariant) {
    return { productId: existingVariant.productId, productCreated: false }
  }

  const productData = {
    name: mapped.name,
    description: mapped.description,
    imageUrl: mapped.imageUrl ?? null,
    categoryId: categoryId ?? null
  }

  if (catalogProductId) {
    const existingProduct = await prisma.product.findUnique({
      where: { id: catalogProductId },
      select: { id: true }
    })
    if (existingProduct) {
      return { productId: existingProduct.id, productCreated: false }
    }
    const created = await prisma.product.create({
      data: { id: catalogProductId, ...productData }
    })
    return { productId: created.id, productCreated: true }
  }

  const created = await prisma.product.create({ data: productData })
  return { productId: created.id, productCreated: true }
}

async function upsertVariant(
  prisma: PrismaClient,
  variantId: string,
  sku: string,
  variantData: {
    productId: string
    name: string
    sku: string
    source: 'MNYAMA_SHOP'
    defaultSellingPrice: number
    defaultCostPrice: number
  }
): Promise<boolean> {
  const byId = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true }
  })
  if (byId) {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: variantData
    })
    return false
  }

  const bySku = await prisma.productVariant.findUnique({
    where: { sku },
    select: { id: true }
  })
  if (bySku && bySku.id !== variantId) {
    await prisma.productVariant.delete({ where: { id: bySku.id } })
  }

  await prisma.productVariant.create({
    data: { id: variantId, ...variantData }
  })
  return true
}

async function upsertCatalogRow(
  prisma: PrismaClient,
  mapped: MnyamaShopFirebaseProduct,
  categoryId: string | undefined
): Promise<UpsertOutcome> {
  const catalogProductId = mapped.agrovetCatalog.productId

  let { productId, productCreated } = await resolveProductId(prisma, mapped, categoryId)

  const productData = {
    name: mapped.name,
    description: mapped.description,
    imageUrl: mapped.imageUrl ?? null,
    categoryId: categoryId ?? null,
    source: 'MNYAMA_SHOP' as const,
    mnyamaShopDocId: mapped.firebaseDocId
  }

  if (catalogProductId && productId !== catalogProductId) {
    const targetProduct = await prisma.product.findUnique({
      where: { id: catalogProductId },
      select: { id: true }
    })
    if (!targetProduct) {
      await prisma.product.create({
        data: { id: catalogProductId, ...productData }
      })
      productCreated = true
    } else {
      await prisma.product.update({
        where: { id: catalogProductId },
        data: productData
      })
    }
    productId = catalogProductId
  } else {
    await prisma.product.update({
      where: { id: productId },
      data: productData
    })
  }

  let variantsCreated = 0
  let variantsUpdated = 0

  for (const variant of mapped.variants) {
    const created = await upsertVariant(prisma, variant.variantId, variant.sku, {
      productId,
      name: variant.name,
      sku: variant.sku,
      source: 'MNYAMA_SHOP',
      defaultSellingPrice: variant.defaultSellingPrice,
      defaultCostPrice: variant.defaultCostPrice
    })
    if (created) variantsCreated += 1
    else variantsUpdated += 1
  }

  return {
    productCreated,
    variantsCreated,
    variantsUpdated
  }
}

export async function seedProductsFromFirebase(
  prisma: PrismaClient,
  options: FirebaseCatalogSeedOptions = {}
): Promise<FirebaseCatalogSeedResult> {
  const dryRun = options.dryRun ?? false
  const productsCollection = options.productsCollection ?? 'products'
  const publishedOnly = options.publishedOnly ?? true

  const result: FirebaseCatalogSeedResult = {
    fetched: 0,
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    skipped: 0,
    skippedNoAgrovetCatalog: 0,
    errors: []
  }

  let docs: ProductDoc[]
  try {
    docs = await loadProductDocuments(productsCollection, publishedOnly)
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
    return result
  }

  result.fetched = docs.length

  for (const doc of docs) {
    const mapped = mapMnyamaShopProduct(doc)
    if (!mapped) {
      result.skipped += 1
      if (asString(doc.data.name) && !parseAgrovetCatalog(doc.data)) {
        result.skippedNoAgrovetCatalog += 1
      }
      continue
    }

    try {
      if (dryRun) {
        continue
      }

      const categoryId = await resolveCategoryId(
        prisma,
        mapped.agrovetCatalog,
        mapped.categoryName
      )
      const { productCreated, variantsCreated, variantsUpdated } = await upsertCatalogRow(
        prisma,
        mapped,
        categoryId
      )

      if (productCreated) result.productsCreated += 1
      else result.productsUpdated += 1

      result.variantsCreated += variantsCreated
      result.variantsUpdated += variantsUpdated
    } catch (error) {
      result.errors.push(
        `Failed to import ${doc.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return result
}
