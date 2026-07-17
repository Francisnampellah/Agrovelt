import { firebaseAuth as defaultFirebaseAuth, firebaseFirestore as defaultFirebaseFirestore } from '../../config/firebase'

export type InvitedFirebaseProfile = {
  email: string
  password: string
  displayName: string
  phoneNo: string
  organization: {
    id: string
    name: string
    slug: string
  }
}

export type ProvisionedFirebaseUser = {
  uid: string
}

type FirebaseAuthLike = {
  createUser: (data: {
    email: string
    password: string
    displayName: string
    emailVerified: boolean
    disabled: boolean
  }) => Promise<{ uid: string }>
  setCustomUserClaims: (uid: string, claims: Record<string, unknown>) => Promise<void>
  deleteUser?: (uid: string) => Promise<void>
}

type FirebaseFirestoreLike = {
  collection: (name: string) => {
    doc: (id: string) => {
      set: (data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<unknown>
    }
  }
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' ')
  }
}

/**
 * Creates a Firebase Auth user and Firestore users/{uid} document shaped like
 * the mobile agrovet profile (collector org fields + onboarding complete).
 */
export async function provisionInvitedFirebaseUser(
  input: InvitedFirebaseProfile,
  deps?: {
    auth?: FirebaseAuthLike
    firestore?: FirebaseFirestoreLike
    now?: Date
  }
): Promise<ProvisionedFirebaseUser> {
  const auth = deps?.auth ?? (defaultFirebaseAuth as unknown as FirebaseAuthLike)
  const firestore = deps?.firestore ?? (defaultFirebaseFirestore as unknown as FirebaseFirestoreLike)
  const now = deps?.now ?? new Date()

  if (typeof auth.createUser !== 'function') {
    throw new Error('Firebase Auth is not configured')
  }
  if (typeof firestore.collection !== 'function') {
    throw new Error('Firebase Firestore is not configured')
  }

  let uid: string | undefined
  const { firstName, lastName } = splitDisplayName(input.displayName)

  try {
    const created = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      // Invited users go through the same email-verification step as
      // everyone else - onboarding stages are pre-marked complete (below),
      // but proving ownership of the email isn't skipped.
      emailVerified: false,
      disabled: false
    })
    uid = created.uid

    await auth.setCustomUserClaims(uid, { globalRole: 'agrovet' })

    await firestore.collection('users').doc(uid).set({
      uid,
      email: input.email,
      display_name: input.displayName,
      first_name: firstName,
      last_name: lastName,
      phone_no: input.phoneNo,
      role: 'agrovet',
      sign_up_provider: 'email',
      verification_status: 'verified',
      on_boarding_complete: true,
      on_boarding_stage_1: true,
      collector_registered: true,
      collector_organization_id: input.organization.id,
      collector_organization_name: input.organization.name,
      collector_organization_slug: input.organization.slug,
      face_photo_url: '',
      gender: '',
      fcmTokens: {},
      created_date: now
    }, { merge: true })

    return { uid }
  } catch (error: any) {
    if (uid && typeof auth.deleteUser === 'function') {
      try {
        await auth.deleteUser(uid)
      } catch (cleanupError) {
        console.warn('Failed to roll back Firebase Auth user after invite failure:', cleanupError)
      }
    }

    const message = error?.message ? String(error.message) : 'Unknown Firebase error'
    if (message.includes('email-already-exists') || message.includes('EMAIL_EXISTS')) {
      throw new Error('A Firebase account already exists for this email')
    }
    throw new Error(`Failed to provision Firebase user: ${message}`)
  }
}
