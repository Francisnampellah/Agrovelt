import test from 'node:test'
import assert from 'node:assert/strict'
import * as authService from './auth.service'

const shouldPreserveLocalRole = (authService as unknown as {
  shouldPreserveLocalRole?: (role: string) => boolean
}).shouldPreserveLocalRole

test('preserves STAFF and MANAGER local roles during Firebase exchange', () => {
  assert.equal(typeof shouldPreserveLocalRole, 'function')
  assert.equal(shouldPreserveLocalRole?.('STAFF'), true)
  assert.equal(shouldPreserveLocalRole?.('MANAGER'), true)
  assert.equal(shouldPreserveLocalRole?.('OWNER'), false)
})
