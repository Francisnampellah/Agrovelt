import assert from 'node:assert/strict'
import test from 'node:test'
import { provisionInvitedFirebaseUser } from './provision-invited-user'

test('provisionInvitedFirebaseUser writes full agrovet Firestore profile', async () => {
  const createdUsers: any[] = []
  const claims: any[] = []
  const docs: any[] = []
  const now = new Date('2026-07-13T12:00:00.000Z')

  const result = await provisionInvitedFirebaseUser(
    {
      email: 'invitee@example.com',
      password: 'Secret123!',
      displayName: 'Nampellah Francis',
      phoneNo: '0772314769',
      organization: {
        id: 'e0d9544b-cf26-44e6-b447-b6dd65ac9e41',
        name: 'here',
        slug: 'here'
      }
    },
    {
      now,
      auth: {
        createUser: async (data) => {
          createdUsers.push(data)
          return { uid: 'PG48LohpnMbaNZx6hw89kw1Uzlu2' }
        },
        setCustomUserClaims: async (uid, data) => {
          claims.push({ uid, data })
        },
        deleteUser: async () => undefined
      },
      firestore: {
        collection: (name) => ({
          doc: (id) => ({
            set: async (data, options) => {
              docs.push({ collection: name, id, data, options })
            }
          })
        })
      }
    }
  )

  assert.equal(result.uid, 'PG48LohpnMbaNZx6hw89kw1Uzlu2')
  assert.equal(createdUsers[0].email, 'invitee@example.com')
  assert.deepEqual(claims[0], {
    uid: 'PG48LohpnMbaNZx6hw89kw1Uzlu2',
    data: { globalRole: 'agrovet' }
  })
  assert.equal(docs[0].collection, 'users')
  assert.equal(docs[0].id, 'PG48LohpnMbaNZx6hw89kw1Uzlu2')
  assert.deepEqual(docs[0].data, {
    uid: 'PG48LohpnMbaNZx6hw89kw1Uzlu2',
    email: 'invitee@example.com',
    display_name: 'Nampellah Francis',
    first_name: 'Nampellah',
    last_name: 'Francis',
    phone_no: '0772314769',
    role: 'agrovet',
    sign_up_provider: 'email',
    verification_status: 'verified',
    on_boarding_complete: true,
    on_boarding_stage_1: true,
    collector_registered: true,
    collector_organization_id: 'e0d9544b-cf26-44e6-b447-b6dd65ac9e41',
    collector_organization_name: 'here',
    collector_organization_slug: 'here',
    face_photo_url: '',
    gender: '',
    fcmTokens: {},
    created_date: now
  })
})
