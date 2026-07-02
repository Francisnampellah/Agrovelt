import { PrismaClient } from '@prisma/client'
import { fetchMnyamaShopPublishedProducts } from './mnyama-shop-firestore.client'
import { getMnyamaShopFirestore, hasMnyamaShopAdminCredentials } from '../../config/mnyama-shop-firebase'

/**
 * Seeds the Collector POS catalog from Mnyama Shop Firestore products.
 *
 * Source (mobile app): `afya-mnyama-digital` / `products` where `published == true`
 * Each Firestore document becomes one Product + one default ProductVariant.
 */
export type FirebaseCatalogSeedOptions = {
  /** Firestore collection (Admin SDK path only). Default: `products` */
  productsCollection?: string
  /** Only import published products (Mnyama Shop catalog). Default: `true` */
  publishedOnly?: boolean
  /** @deprecated Variant name is always the product name */
  defaultVariantName?: string
  /** SKU prefix for generated variants. Default: `MSHOP` */
  skuPrefix?: string
  /** When true, only reports what would be written */
  dryRun?: boolean
}

export type FirebaseCatalogSeedResult = {
  dryRun: boolean
  productsCollection: string
  publishedOnly: boolean
  source: 'client-api' | 'admin-sdk'
  scanned: number
  createdProducts: number
  updatedProducts: number
  createdVariants: number
  updatedVariants: number
  skipped: number
  errors: Array<{ docId: string; error: string }>
}

/** Mnyama Shop Firestore product document (afya-mnyama-digital / products) */
export type MnyamaShopFirebaseProduct = {
  name?: string
  description_html?: string
  category?: string
  images?: string[]
  published?: boolean
  quantity_in_stock?: number | string
  min_oq?: number | string
  max_oq?: number | string
  base_price_constant?: number | string
  discount_rate_constant?: number | string
}

type FirebaseProductRecord = Record<string, unknown>

type ProductDoc = { id: string; data: FirebaseProductRecord }

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  return false
}

function asIntegerPrice(value: unknown): number | undefined {
  const parsed = asNumber(value)
  if (parsed === undefined) return undefined
  return Math.round(parsed)
}

function sanitizeDocId(docId: string): string {
  const cleaned = docId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return cleaned.length > 0 ? cleaned.slice(0, 32) : docId.replace(/\s+/g, '-').slice(0, 32)
}

function buildMnyamaShopSku(docId: string, prefix: string): string {
  return `${prefix}-${sanitizeDocId(docId)}-DEFAULT`
}

function resolveFirstImage(data: FirebaseProductRecord): string | undefined {
  const images = data.images
  if (Array.isArray(images)) {
    for (const item of images) {
      const url = asString(item)
      if (url) return url
    }
  }

  return (
    asString(data.imageUrl) ??
    asString(data.image) ??
    asString(data.photoUrl)
  )
}

function guessImageMimeType(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null
  const lower = imageUrl.toLowerCase()
  if (lower.includes('.png')) return 'image/png'
  if (lower.includes('.webp')) return 'image/webp'
  if (lower.includes('.gif')) return 'image/gif'
  return 'image/jpeg'
}

/**
 * Map a Mnyama Shop Firestore product document to POS catalog rows.
 */
export function mapMnyamaShopProduct(
  docId: string,
  data: FirebaseProductRecord,
  options: Required<Pick<FirebaseCatalogSeedOptions, 'defaultVariantName' | 'skuPrefix'>>
) {
  const shop = data as MnyamaShopFirebaseProduct
  const name = asString(shop.name) ?? `Product ${docId}`
  const categoryName = asString(shop.category)
  const description = asString(shop.description_html) ?? asString(data.description)
  const imageUrl = resolveFirstImage(data)
  const basePrice = asIntegerPrice(shop.base_price_constant)

  return {
    firebaseDocId: docId,
    name,
    categoryName,
    description,
    imageUrl,
    imageMimeType: guessImageMimeType(imageUrl),
    variant: {
      id: docId,
      name,
      sku: buildMnyamaShopSku(docId, options.skuPrefix),
      defaultCostPrice: undefined as number | undefined,
      defaultSellingPrice: basePrice
    },
    shopMeta: {
      published: asBoolean(shop.published),
      quantityInStock: asNumber(shop.quantity_in_stock),
      minOrderQty: asNumber(shop.min_oq),
      maxOrderQty: asNumber(shop.max_oq),
      discountRateConstant: asNumber(shop.discount_rate_constant)
    }
  }
}

async function ensureCategory(
  prisma: PrismaClient,
  categoryName: string | undefined,
  categoryMap: Map<string, string>,
  dryRun: boolean
): Promise<string | undefined> {
  if (!categoryName) return undefined

  const cacheKey = categoryName.toLowerCase()
  const cached = categoryMap.get(cacheKey)
  if (cached) return cached

  const existing = await prisma.category.findFirst({
    where: { name: { equals: categoryName, mode: 'insensitive' } }
  })

  if (existing) {
    categoryMap.set(cacheKey, existing.id)
    return existing.id
  }

  if (dryRun) {
    const placeholder = `dry-run-category:${categoryName}`
    categoryMap.set(cacheKey, placeholder)
    return placeholder
  }

  const created = await prisma.category.create({ data: { name: categoryName } })
  categoryMap.set(cacheKey, created.id)
  return created.id
}

async function loadProductDocuments(
  productsCollection: string,
  publishedOnly: boolean
): Promise<{ source: 'client-api' | 'admin-sdk'; docs: ProductDoc[] }> {
  const mnyamaProject = process.env.MNYAMA_SHOP_FIREBASE_PROJECT_ID ?? 'afya-mnyama-digital'

  if (publishedOnly) {
    try {
      const docs = await fetchMnyamaShopPublishedProducts()
      console.log(`Fetched ${docs.length} published products from ${mnyamaProject} via Firebase client API`)
      return {
        source: 'client-api',
        docs: docs.map(doc => ({ id: doc.id, data: doc.data }))
      }
    } catch (clientError: any) {
      console.warn(`Mnyama Shop client API fetch failed: ${clientError?.message ?? clientError}`)
    }
  }

  if (!hasMnyamaShopAdminCredentials()) {
    throw new Error(
      'Could not load Mnyama Shop products via client API and no afya-mnyama-digital Admin credentials found. ' +
      'Set MNYAMA_SHOP_FIREBASE_API_KEY or add afya-mnyama-digital service account JSON.'
    )
  }

  const firestore = getMnyamaShopFirestore()
  const collectionRef = firestore.collection(productsCollection)
  const snapshot = publishedOnly
    ? await collectionRef.where('published', '==', true).get()
    : await collectionRef.get()

  console.log(`Fetched ${snapshot.size} products from ${mnyamaProject} via Firebase Admin SDK`)

  return {
    source: 'admin-sdk',
    docs: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as FirebaseProductRecord }))
  }
}

/**
 * Import Mnyama Shop products from Firestore into Prisma.
 * Each document → one Product + one default ProductVariant (variant name = product name).
 */
export async function seedProductsFromFirebase(
  prisma: PrismaClient,
  options: FirebaseCatalogSeedOptions = {}
): Promise<FirebaseCatalogSeedResult> {
  const productsCollection = options.productsCollection ?? 'products'
  const publishedOnly = options.publishedOnly ?? true
  const defaultVariantName = options.defaultVariantName ?? 'Default'
  const skuPrefix = options.skuPrefix ?? 'MSHOP'
  const dryRun = options.dryRun ?? false

  const result: FirebaseCatalogSeedResult = {
    dryRun,
    productsCollection,
    publishedOnly,
    source: 'client-api',
    scanned: 0,
    createdProducts: 0,
    updatedProducts: 0,
    createdVariants: 0,
    updatedVariants: 0,
    skipped: 0,
    errors: []
  }

  const { source, docs } = await loadProductDocuments(productsCollection, publishedOnly)
  result.source = source

  const categoryMap = new Map<string, string>()

  for (const doc of docs) {
    result.scanned++

    try {
      const mapped = mapMnyamaShopProduct(doc.id, doc.data, { defaultVariantName, skuPrefix })

      if (!mapped.name) {
        result.skipped++
        continue
      }

      const categoryId = await ensureCategory(prisma, mapped.categoryName, categoryMap, dryRun)

      if (dryRun) {
        result.createdProducts++
        result.createdVariants++
        continue
      }

      const firebaseId = mapped.firebaseDocId

      const existingVariant = await prisma.productVariant.findUnique({
        where: { id: firebaseId },
        select: { id: true, productId: true }
      })

      let productId = existingVariant?.productId

      if (!productId) {
        const existingProduct = await prisma.product.findUnique({
          where: { id: firebaseId },
          select: { id: true }
        })
        productId = existingProduct?.id
      }

      const productData = {
        name: mapped.name,
        description: mapped.description ?? null,
        categoryId: categoryId ?? null,
        unit: null,
        dosageInfo: null,
        manufacturer: null,
        isRestricted: false,
        imageUrl: mapped.imageUrl ?? null,
        imageMimeType: mapped.imageMimeType ?? null
      }

      const existingProductBefore = await prisma.product.findUnique({
        where: { id: firebaseId },
        select: { id: true }
      })

      await prisma.product.upsert({
        where: { id: firebaseId },
        create: { id: firebaseId, ...productData },
        update: productData
      })
      productId = firebaseId

      if (existingProductBefore) {
        result.updatedProducts++
      } else {
        result.createdProducts++
      }

      const variantData = {
        productId,
        name: mapped.variant.name,
        sku: mapped.variant.sku,
        defaultCostPrice: mapped.variant.defaultCostPrice ?? null,
        defaultSellingPrice: mapped.variant.defaultSellingPrice ?? null
      }

      const existingVariantBefore = await prisma.productVariant.findUnique({
        where: { id: firebaseId },
        select: { id: true }
      })

      await prisma.productVariant.upsert({
        where: { id: firebaseId },
        update: variantData,
        create: { id: firebaseId, ...variantData }
      })

      if (existingVariantBefore) {
        result.updatedVariants++
      } else {
        result.createdVariants++
      }
    } catch (error: any) {
      result.errors.push({
        docId: doc.id,
        error: error?.message ?? 'Unknown error'
      })
      result.skipped++
    }
  }

  return result
}
