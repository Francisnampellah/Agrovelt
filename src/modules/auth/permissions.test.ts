import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canManageUsers,
  canAddOrgFunding,
  canAddStock,
  canPurchase,
  canGenerateReports,
  canSell,
  canRefund,
  canAddExpense,
  canViewShopFinance,
  canDownloadReceipt
} from './permissions'

test('only OWNER (and platform admins) can manage users', () => {
  assert.equal(canManageUsers({ userId: '1', role: 'OWNER' }), true)
  assert.equal(canManageUsers({ userId: '1', role: 'ADMIN' }), true)
  assert.equal(canManageUsers({ userId: '1', role: 'SUPER_ADMIN' }), true)
  assert.equal(canManageUsers({ userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' }), false)
  assert.equal(canManageUsers({ userId: '1', role: 'STAFF' }), false)
})

test('org funding allowed for OWNER and ALL_SHOPS manager only', () => {
  assert.equal(canAddOrgFunding({ userId: '1', role: 'OWNER' }), true)
  assert.equal(canAddOrgFunding({ userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' }), true)
  assert.equal(canAddOrgFunding({ userId: '1', role: 'MANAGER', managerAccess: 'ONE_SHOP' }), false)
  assert.equal(canAddOrgFunding({ userId: '1', role: 'STAFF' }), false)
})

test('staff shop ops require shopInScope', () => {
  const staff = { userId: '1', role: 'STAFF' }
  assert.equal(canSell(staff, true), true)
  assert.equal(canSell(staff, false), false)
  assert.equal(canRefund(staff, true), true)
  assert.equal(canAddExpense(staff, true), true)
  assert.equal(canViewShopFinance(staff, true), true)
  assert.equal(canDownloadReceipt(staff, true), true)
  assert.equal(canAddStock(staff, true), false)
  assert.equal(canPurchase(staff, true), false)
  assert.equal(canGenerateReports(staff, { allShopsScope: false }), false)
})

test('manager can stock/purchase/report in scope', () => {
  const one = { userId: '1', role: 'MANAGER', managerAccess: 'ONE_SHOP' as const }
  const all = { userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' as const }
  assert.equal(canAddStock(one, true), true)
  assert.equal(canAddStock(one, false), false)
  assert.equal(canPurchase(all, true), true)
  assert.equal(canGenerateReports(one, { allShopsScope: false }), true)
  assert.equal(canGenerateReports(all, { allShopsScope: true }), true)
})
