import * as admin from 'firebase-admin'
import type { Auth } from 'firebase-admin/auth'
import type { Database } from 'firebase-admin/database'

import fs from 'fs'
import path from 'path'

// Initialize Firebase Admin
// You need to set FIREBASE_CREDENTIALS environment variable or download service account JSON
const getCredentials = () => {
  if (process.env.FIREBASE_CREDENTIALS) {
    try {
      return JSON.parse(process.env.FIREBASE_CREDENTIALS)
    } catch (e) {
      console.error('❌ Failed to parse FIREBASE_CREDENTIALS environment variable')
      return null
    }
  }
  
  try {
    const credPath = path.join(__dirname, '../../firebase-credentials.json')
    if (fs.existsSync(credPath)) {
      return JSON.parse(fs.readFileSync(credPath, 'utf8'))
    }
  } catch (e) {
    console.error('❌ Error reading firebase-credentials.json')
  }
  
  return null
}

const firebaseCredentials = getCredentials()

if (firebaseCredentials && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseCredentials),
    databaseURL: `https://${firebaseCredentials.project_id}.firebaseio.com`
  })
} else if (!firebaseCredentials) {
  console.warn('⚠️ FIREBASE_CREDENTIALS not found. Firebase features will be disabled.')
}

export const firebaseAuth: Auth = firebaseCredentials ? admin.auth() : ({} as Auth)
