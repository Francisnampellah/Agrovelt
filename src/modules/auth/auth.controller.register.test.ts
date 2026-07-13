import test from 'node:test'
import assert from 'node:assert/strict'
import { validationResult } from 'express-validator'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

const controller = new AuthController({} as AuthService)

async function runRegisterValidation(body: Record<string, unknown>) {
  const req = { body } as Parameters<typeof validationResult>[0]
  for (const rule of controller.registerValidation) {
    await rule.run(req)
  }
  return validationResult(req)
}

const baseBody = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Password1',
  organizationId: '123e4567-e89b-12d3-a456-426614174000'
}

test('registerValidation rejects STAFF role', async () => {
  const result = await runRegisterValidation({ ...baseBody, role: 'STAFF' })
  assert.ok(!result.isEmpty())
  const firstError = result.array()[0]
  assert.ok(firstError)
  assert.equal(firstError.msg, 'Invalid role')
})

test('registerValidation rejects MANAGER role', async () => {
  const result = await runRegisterValidation({ ...baseBody, role: 'MANAGER' })
  assert.ok(!result.isEmpty())
  const firstError = result.array()[0]
  assert.ok(firstError)
  assert.equal(firstError.msg, 'Invalid role')
})

test('registerValidation accepts OWNER role', async () => {
  const result = await runRegisterValidation({ ...baseBody, role: 'OWNER' })
  assert.ok(result.isEmpty())
})
