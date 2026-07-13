import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAuthActor } from './assertActor'

test('loadAuthActor reads the active user authorization state from the database', async () => {
  const prisma = {
    user: {
      findUnique: async () => ({
        role: 'MANAGER',
        organizationId: 'org-1',
        managerAccess: 'ONE_SHOP',
        isActive: true
      })
    }
  }

  const actor = await loadAuthActor(prisma as never, {
    user: {
      userId: 'user-1',
      email: 'manager@example.com',
      role: 'STAFF'
    }
  } as never)

  assert.deepEqual(actor, {
    userId: 'user-1',
    role: 'MANAGER',
    organizationId: 'org-1',
    managerAccess: 'ONE_SHOP'
  })
})

test('loadAuthActor rejects inactive and missing users', async () => {
  const prisma = {
    user: {
      findUnique: async () => ({
        role: 'STAFF',
        organizationId: 'org-1',
        managerAccess: null,
        isActive: false
      })
    }
  }

  await assert.rejects(
    loadAuthActor(prisma as never, {
      user: { userId: 'user-1', email: 'staff@example.com', role: 'STAFF' }
    } as never),
    /User account is deactivated/
  )
})
