/**
 * Read Mnyama Shop products from Firestore without Admin SDK.
 * Uses Firestore REST API + Firebase Web API key (afya-mnyama-digital).
 */

const DEFAULT_PROJECT_ID = 'afya-mnyama-digital'
const DEFAULT_API_KEY = 'AIzaSyARQmqdNHB5EW99lQtrhevPvbHc_J2AFyM'

export type MnyamaShopFirestoreDoc = {
  id: string
  data: Record<string, unknown>
}

function getMnyamaShopConfig() {
  return {
    projectId: process.env.MNYAMA_SHOP_FIREBASE_PROJECT_ID ?? DEFAULT_PROJECT_ID,
    apiKey: process.env.MNYAMA_SHOP_FIREBASE_API_KEY ?? DEFAULT_API_KEY
  }
}

function parseFirestoreValue(value: Record<string, unknown>): unknown {
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('nullValue' in value) return null
  if ('arrayValue' in value) {
    const items = (value.arrayValue as { values?: Record<string, unknown>[] })?.values ?? []
    return items.map(parseFirestoreValue)
  }
  if ('mapValue' in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields ?? {}
    return parseFirestoreFields(fields)
  }
  return undefined
}

function parseFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(value)
  }
  return result
}

function parseQueryDocuments(payload: unknown): MnyamaShopFirestoreDoc[] {
  if (!Array.isArray(payload)) return []

  const docs: MnyamaShopFirestoreDoc[] = []
  for (const row of payload) {
    const document = (row as { document?: { name?: string; fields?: Record<string, Record<string, unknown>> } }).document
    if (!document?.name || !document.fields) continue

    const id = document.name.split('/').pop() ?? document.name
    docs.push({
      id,
      data: parseFirestoreFields(document.fields)
    })
  }

  return docs
}

/**
 * Fetch published products from Firestore `products` collection.
 * Matches mobile: `.where('published', isEqualTo: true)`
 */
export async function fetchMnyamaShopPublishedProducts(): Promise<MnyamaShopFirestoreDoc[]> {
  const { projectId, apiKey } = getMnyamaShopConfig()
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery` +
    `?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'products' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'published' },
            op: 'EQUAL',
            value: { booleanValue: true }
          }
        }
      }
    })
  })

  const body = await response.json() as unknown
  if (!response.ok) {
    const message = (body as { error?: { message?: string } })?.error?.message
      ?? `Firestore query failed (${response.status})`
    throw new Error(message)
  }

  return parseQueryDocuments(body)
}
