import * as admin from 'firebase-admin'
import type { Firestore } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'

const MNYAMA_PROJECT_ID = process.env.MNYAMA_SHOP_FIREBASE_PROJECT_ID ?? 'afya-mnyama-digital'
const MNYAMA_APP_NAME = 'mnyama-shop'

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const resolved = path.resolve(process.cwd(), filePath)
    if (!fs.existsSync(resolved)) return null
    return JSON.parse(fs.readFileSync(resolved, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function loadMnyamaShopCredentials(): Record<string, unknown> | null {
  if (process.env.MNYAMA_SHOP_FIREBASE_CREDENTIALS) {
    try {
      return JSON.parse(process.env.MNYAMA_SHOP_FIREBASE_CREDENTIALS) as Record<string, unknown>
    } catch {
      console.error('Failed to parse MNYAMA_SHOP_FIREBASE_CREDENTIALS')
    }
  }

  const candidateFiles = [
    process.env.MNYAMA_SHOP_FIREBASE_CREDENTIALS_FILE,
    process.env.FIREBASE_CREDENTIALS_FILE,
    'afya-mnyama-digital-firebase-adminsdk-fbsvc-280bd6e441.json',
    'firebase-credentials.json'
  ].filter((value): value is string => Boolean(value))

  for (const file of candidateFiles) {
    const credentials = readJsonFile(file)
    if (credentials?.project_id === MNYAMA_PROJECT_ID) {
      return credentials
    }
  }

  return null
}

let mnyamaFirestore: Firestore | null = null

export function getMnyamaShopFirestore(): Firestore {
  if (mnyamaFirestore) return mnyamaFirestore

  const credentials = loadMnyamaShopCredentials()
  if (!credentials) {
    throw new Error(
      `No Firebase Admin credentials found for "${MNYAMA_PROJECT_ID}". ` +
      'Download the service account JSON from Firebase Console → afya-mnyama-digital → ' +
      'Project settings → Service accounts, save it as ' +
      'afya-mnyama-digital-firebase-adminsdk-fbsvc-280bd6e441.json in the project root, ' +
      'or set MNYAMA_SHOP_FIREBASE_CREDENTIALS_FILE.'
    )
  }

  const existing = admin.apps.find(app => app?.name === MNYAMA_APP_NAME)
  const app = existing
    ?? admin.initializeApp(
      {
        credential: admin.credential.cert(credentials as admin.ServiceAccount),
        projectId: MNYAMA_PROJECT_ID
      },
      MNYAMA_APP_NAME
    )

  mnyamaFirestore = app.firestore()
  return mnyamaFirestore
}

export function hasMnyamaShopAdminCredentials(): boolean {
  return loadMnyamaShopCredentials() !== null
}
