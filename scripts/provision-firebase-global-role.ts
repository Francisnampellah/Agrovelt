/**
 * Set Firebase custom claim globalRole for a user (Agrovet exchange gate).
 *
 * Usage:
 *   npx ts-node scripts/provision-firebase-global-role.ts <email> <agrovet|admin|dev>
 *
 * Requires FIREBASE_CREDENTIALS or firebase-credentials.json in project root.
 * User must sign out and sign in again on mobile/web to refresh the ID token.
 */
import 'dotenv/config'
import * as admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import { AGROVET_EXCHANGE_GLOBAL_ROLES } from '../src/modules/auth/firebaseRoleMapping'

function loadCredentials() {
  if (process.env.FIREBASE_CREDENTIALS) {
    return JSON.parse(process.env.FIREBASE_CREDENTIALS)
  }
  const credPath = path.join(process.cwd(), 'firebase-credentials.json')
  if (fs.existsSync(credPath)) {
    return JSON.parse(fs.readFileSync(credPath, 'utf8'))
  }
  throw new Error('Set FIREBASE_CREDENTIALS or add firebase-credentials.json')
}

async function main() {
  const email = process.argv[2]
  const role = process.argv[3]?.toLowerCase()

  if (!email || !role) {
    console.error(
      'Usage: npx ts-node scripts/provision-firebase-global-role.ts <email> <agrovet|admin|dev>'
    )
    process.exit(1)
  }

  if (!AGROVET_EXCHANGE_GLOBAL_ROLES.includes(role as typeof AGROVET_EXCHANGE_GLOBAL_ROLES[number])) {
    console.error(`Invalid role "${role}". Allowed: ${AGROVET_EXCHANGE_GLOBAL_ROLES.join(', ')}`)
    process.exit(1)
  }

  const credentials = loadCredentials()
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(credentials) })
  }

  const user = await admin.auth().getUserByEmail(email)
  await admin.auth().setCustomUserClaims(user.uid, { globalRole: role })

  console.log(`Set globalRole="${role}" for ${email} (uid: ${user.uid})`)
  console.log('User must sign out and sign in again to get a new ID token with the claim.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
