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
 * `productId`  → Postgres Product.id (when present)
 * `variantId`  → Postgres ProductVariant.id (required)
 */
export type AgrovetCatalogLink = {
  categoryId?: string
  productId?: string
  variantId: string
  sku?: string
  syncStatus?: string
  syncedAt?: string
}

export type MnyamaShopFirebaseProduct = {
  firebaseDocId: string
  agrovetCatalog: AgrovetCatalogLink
  name: string
  description: string
  categoryName?: string
  imageUrl?: string
  variant: {
    sku: string
    name: string
    defaultSellingPrice: number
    defaultCostPrice: number
    stockQuantity: number
    isActive: boolean
  }
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

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  return fallback
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

function sanitizeSkuPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').toUpperCase()
}

function fallbackVariantSku(firebaseDocId: string): string {
  return `MSHOP-${sanitizeSkuPart(firebaseDocId)}-DEFAULT`
}

export function parseAgrovetCatalog(data: Record<string, unknown>): AgrovetCatalogLink | null {
  const raw = data.agrovet_catalog
  if (!raw || typeof raw !== 'object') return null

  const catalog = raw as Record<string, unknown>
  const variantId = asString(catalog.variant_id)

  if (!variantId || !isUuid(variantId)) return null

  const link: AgrovetCatalogLink = { variantId }

  const productId = asString(catalog.product_id)
  if (productId && isUuid(productId)) {
    link.productId = productId
  }

  const categoryId = asString(catalog.category_id)
  if (categoryId && isUuid(categoryId)) {
    link.categoryId = categoryId
  }

  const sku = asString(catalog.sku)
  if (sku) link.sku = sku

  const syncStatus = asString(catalog.sync_status)
  if (syncStatus) link.syncStatus = syncStatus

  const syncedAt = asString(catalog.synced_at)
  if (syncedAt) link.syncedAt = syncedAt

  return link
}

export function mapMnyamaShopProduct(doc: ProductDoc): MnyamaShopFirebaseProduct | null {
  const name = asString(doc.data.name)
  if (!name) return null

  const agrovetCatalog = parseAgrovetCatalog(doc.data)
  if (!agrovetCatalog) return null

  const basePrice = asNumber(doc.data.base_price_constant) ?? 0
  const sellingPrice = Math.round(basePrice)
  const sku = agrovetCatalog.sku ?? fallbackVariantSku(doc.id)

  return {
    firebaseDocId: doc.id,
    agrovetCatalog,
    name,
    description: asString(doc.data.description_html) ?? '',
    ...(asString(doc.data.category) ? { categoryName: asString(doc.data.category)! } : {}),
    ...(firstImageUrl(doc.data.images) ? { imageUrl: firstImageUrl(doc.data.images)! } : {}),
    variant: {
      sku,
      name,
      defaultSellingPrice: sellingPrice,
      defaultCostPrice: sellingPrice,
      stockQuantity: asNumber(doc.data.quantity_in_stock) ?? 0,
      isActive: asBoolean(doc.data.published, true)
    }
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
  variantCreated: boolean
}

async function resolveProductId(
  prisma: PrismaClient,
  mapped: MnyamaShopFirebaseProduct,
  categoryId: string | undefined
): Promise<{ productId: string; productCreated: boolean }> {
  const { variantId, productId: catalogProductId } = mapped.agrovetCatalog

  const existingVariant = await prisma.productVariant.findUnique({
    where: { id: variantId },
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
  const variantId = mapped.agrovetCatalog.variantId
  const catalogProductId = mapped.agrovetCatalog.productId

  let { productId, productCreated } = await resolveProductId(prisma, mapped, categoryId)

  const productData = {
    name: mapped.name,
    description: mapped.description,
    imageUrl: mapped.imageUrl ?? null,
    categoryId: categoryId ?? null
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

  const variantData = {
    productId,
    name: mapped.variant.name,
    sku: mapped.variant.sku,
    defaultSellingPrice: mapped.variant.defaultSellingPrice,
    defaultCostPrice: mapped.variant.defaultCostPrice
  }

  const variantCreated = await upsertVariant(
    prisma,
    variantId,
    mapped.variant.sku,
    variantData
  )

  return {
    productCreated,
    variantCreated
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
      const { productCreated, variantCreated } = await upsertCatalogRow(
        prisma,
        mapped,
        categoryId
      )

      if (productCreated) result.productsCreated += 1
      else result.productsUpdated += 1

      if (variantCreated) result.variantsCreated += 1
      else result.variantsUpdated += 1
    } catch (error) {
      result.errors.push(
        `Failed to import ${doc.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return result
}
