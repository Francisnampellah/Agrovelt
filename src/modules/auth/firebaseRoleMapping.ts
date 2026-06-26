import { Role } from '@prisma/client'

export const ALLOWED_FIREBASE_GLOBAL_ROLES = ['agrovet', 'admin', 'dev'] as const

export type FirebaseGlobalRole = typeof ALLOWED_FIREBASE_GLOBAL_ROLES[number]

export function normalizeFirebaseGlobalRole(role: unknown): FirebaseGlobalRole | null {
  if (typeof role !== 'string') return null

  const normalized = role.trim().toLowerCase()
  return ALLOWED_FIREBASE_GLOBAL_ROLES.includes(normalized as FirebaseGlobalRole)
    ? normalized as FirebaseGlobalRole
    : null
}

export function mapFirebaseGlobalRoleToAgrovetRole(role: FirebaseGlobalRole): Role {
  switch (role) {
    case 'dev':
      return Role.SUPER_ADMIN
    case 'admin':
      return Role.ADMIN
    case 'agrovet':
      return Role.OWNER
  }
}
