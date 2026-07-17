import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import type { FieldValue as FieldValueType } from 'firebase-admin/firestore'

/**
 * One-time migration: converts Mnyama Shop product docs in Firestore from
 * the old single-variant structure (`agrovet_catalog.variant_id` + flat
 * product-level pricing/stock fields) to the new multi-variant structure
 * (`agrovet_catalog.default_variant_id` + a `variants[]` array).
 *
 * Old docs are synthesized into a single "Default" variant, mirroring
 * exactly what AMD_web_app's buildLegacyVariantFromProduct/
 * serializeVariantForFirestore already do on the read side — so this just
 * makes durable in Firestore what the app already inferred at read time.
 *
 * Also refreshes agrovet_catalog.category_id by looking up the doc's
 * plain-text `category` field against Postgres (name match, case
 * insensitive) — optional/best-effort, since the seed's own sync already
 * falls back to name matching regardless.
 *
 * SAFETY: defaults to a dry run (no writes). Pass --apply to actually
 * write. Requires Firebase Admin credentials (same as the rest of the
 * Firestore catalog sync) and DATABASE_URL for the category lookup.
 *
 * Usage (from inside the running app container):
 *   npx ts-node scripts/migrate-firestore-product-structure.ts
 *   npx ts-node scripts/migrate-firestore-product-structure.ts --apply
 */

type PlanEntry = {
  docId: string
  reason: 'already-new' | 'unlinked' | 'migrated'
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function sanitizeSkuPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').toUpperCase()
}

function computeDRC(minOq: number, maxOq: number, minOp: number, maxOp: number): number {
  if (!minOq || minOq === maxOq) return 0
  return (maxOp * minOq - minOp * maxOq) / (maxOq * minOq * (minOq - maxOq))
}

function computeBPC(minOq: number, maxOq: number, minOp: number, maxOp: number): number {
  if (!minOq) return 0
  const drc = computeDRC(minOq, maxOq, minOp, maxOp)
  return minOp / minOq + drc * minOq
}

// Builds the exact object passed to doc.ref.update(). Firestore requires
// FieldValue.delete() to appear as a genuine top-level key of the update()
// call (dot-notation, e.g. "agrovet_catalog.variant_id") — it cannot be
// nested inside a plain object value, which is what update({ agrovet_catalog:
// { ...fields, variant_id: FieldValue.delete() } }) tried to do and Firestore
// rejects at the SDK level (before any network call). Every other
// agrovet_catalog.* field is written the same dot-notation way so this one
// update() call replaces exactly the fields we intend, leaving anything else
// on the document untouched.
export function buildFirestoreUpdatePayload(
  newCatalog: Record<string, unknown>,
  synthesizedVariant: Record<string, unknown>,
  deleteSentinel: unknown
): Record<string, unknown> {
  const payload: Record<string, unknown> = { variants: [synthesizedVariant] }

  for (const [key, value] of Object.entries(newCatalog)) {
    payload[`agrovet_catalog.${key}`] = value
  }

  payload['agrovet_catalog.variant_id'] = deleteSentinel

  return payload
}

async function resolveCategoryId(
  prisma: PrismaClient,
  categoryName: string | undefined
): Promise<string | undefined> {
  if (!categoryName) return undefined
  const existing = await prisma.category.findFirst({
    where: { name: { equals: categoryName, mode: 'insensitive' } },
    select: { id: true }
  })
  return existing?.id
}

async function main() {
  const apply = process.argv.includes('--apply')

  const { getMnyamaShopFirestore } = await import('../src/config/mnyama-shop-firebase')
  const firestore = getMnyamaShopFirestore()
  const prisma = new PrismaClient()

  const snapshot = await firestore.collection('products').get()
  const plan: PlanEntry[] = []
  const errors: string[] = []
  let fieldValueDelete: FieldValueType | null = null
  if (apply) {
    const { FieldValue } = await import('firebase-admin/firestore')
    fieldValueDelete = FieldValue.delete()
  }

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>
    const rawCatalog = data.agrovet_catalog
    if (!rawCatalog || typeof rawCatalog !== 'object') continue

    const catalog = rawCatalog as Record<string, unknown>
    const defaultVariantId = asString(catalog.default_variant_id)
    const legacyVariantId = asString(catalog.variant_id)
    const existingVariants = Array.isArray(data.variants) ? data.variants : []

    if (defaultVariantId && existingVariants.length > 0) {
      plan.push({ docId: doc.id, reason: 'already-new' })
      continue
    }

    if (!legacyVariantId) {
      // agrovet_catalog present but no usable link either way — not our
      // concern, leave untouched (matches how the seed itself skips these).
      plan.push({ docId: doc.id, reason: 'unlinked' })
      continue
    }

    const minOq = asNumber(data.min_oq)
    const minOp = asNumber(data.min_op)
    const maxOq = asNumber(data.max_oq)
    const maxOp = asNumber(data.max_op)
    const defaultSellingPrice = minOq > 0 ? minOp / minOq : 0

    const categoryName = asString(data.category)
    const resolvedCategoryId = await resolveCategoryId(prisma, categoryName)

    const synthesizedVariant = {
      name: 'Default',
      sku: asString(catalog.sku) ?? `MSHOP-${sanitizeSkuPart(doc.id)}-DEFAULT`,
      variant_id: legacyVariantId,
      min_oq: data.min_oq ?? null,
      min_op: data.min_op ?? null,
      max_oq: data.max_oq ?? null,
      max_op: data.max_op ?? null,
      quantity_in_stock: data.quantity_in_stock ?? null,
      base_price_constant: asNumber(data.base_price_constant) || computeBPC(minOq, maxOq, minOp, maxOp),
      discount_rate_constant: asNumber(data.discount_rate_constant) || computeDRC(minOq, maxOq, minOp, maxOp),
      default_selling_price: defaultSellingPrice,
      default_cost_price: defaultSellingPrice
    }

    const newCatalog: Record<string, unknown> = {
      product_id: catalog.product_id ?? null,
      default_variant_id: legacyVariantId,
      category_id: resolvedCategoryId ?? catalog.category_id ?? null,
      sync_status: catalog.sync_status ?? 'synced',
      sync_error: catalog.sync_error ?? null,
      synced_at: catalog.synced_at ?? new Date().toISOString()
    }

    plan.push({
      docId: doc.id,
      reason: 'migrated',
      before: { agrovet_catalog: catalog, variants: existingVariants },
      after: { agrovet_catalog: newCatalog, variants: [synthesizedVariant] }
    })

    if (apply) {
      try {
        await doc.ref.update(
          buildFirestoreUpdatePayload(newCatalog, synthesizedVariant, fieldValueDelete)
        )
      } catch (error) {
        errors.push(
          `Failed to migrate ${doc.id}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  const summary = {
    mode: apply ? 'APPLIED' : 'DRY RUN (pass --apply to write)',
    totalDocsWithAgrovetCatalog: plan.length,
    alreadyNewStructure: plan.filter(p => p.reason === 'already-new').length,
    unlinkedSkipped: plan.filter(p => p.reason === 'unlinked').length,
    migrated: plan.filter(p => p.reason === 'migrated').length,
    failed: errors.length,
    errors
  }

  console.log(JSON.stringify(summary, null, 2))
  console.log('\nMigrated doc details:')
  for (const entry of plan.filter(p => p.reason === 'migrated')) {
    console.log(JSON.stringify(entry, null, 2))
  }

  await prisma.$disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
