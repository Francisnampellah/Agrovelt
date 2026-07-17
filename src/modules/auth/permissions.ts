export type AuthActor = {
  userId: string
  role: string
  organizationId?: string | null
  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
}

function isPlatformAdmin(actor: AuthActor): boolean {
  return actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN'
}

export function canManageUsers(actor: AuthActor): boolean {
  return actor.role === 'OWNER' || isPlatformAdmin(actor)
}

export function canAddOrgFunding(actor: AuthActor): boolean {
  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
  return actor.role === 'MANAGER' && actor.managerAccess === 'ALL_SHOPS'
}

export function canAddStock(actor: AuthActor, shopInScope: boolean): boolean {
  if (!shopInScope) return false
  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
  return actor.role === 'MANAGER'
}

export function canPurchase(actor: AuthActor, shopInScope: boolean): boolean {
  return canAddStock(actor, shopInScope)
}

export function canGenerateReports(
  actor: AuthActor,
  opts: { allShopsScope: boolean }
): boolean {
  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
  if (actor.role !== 'MANAGER') return false
  if (actor.managerAccess === 'ALL_SHOPS') return true
  return !opts.allShopsScope
}

/** Business report API: MANAGER may generate within resolved shop scope (including omitted shopIds). */
export function canGenerateBusinessReport(actor: AuthActor): boolean {
  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
  return actor.role === 'MANAGER'
}

function shopOpsAllowed(actor: AuthActor, shopInScope: boolean): boolean {
  if (!shopInScope) return false
  return (
    actor.role === 'OWNER' ||
    actor.role === 'MANAGER' ||
    actor.role === 'STAFF' ||
    isPlatformAdmin(actor)
  )
}

export const canSell = shopOpsAllowed
export const canRefund = shopOpsAllowed
export const canAddExpense = shopOpsAllowed
export const canViewShopFinance = shopOpsAllowed
export const canDownloadReceipt = shopOpsAllowed
