### Task 5: Profile + Firebase exchange preserve STAFF/MANAGER + rich shopScope

**Files:**
- Modify: `src/modules/auth/types.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `src/modules/auth/collectorResponse.ts` (if used for client payloads)
- Create: `src/modules/auth/auth.service.exchange.test.ts` (unit test with mocked prisma/firebase if feasible; otherwise test pure preserve helper)

**Interfaces:**
- Produces profile/token user shape:
```typescript
{
  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
  allShops: boolean
  shopScope: { shopId: string; name: string }[] // prefer objects; if breaking clients, also keep string[] ids under shopScopeIds
}
```
- Prefer additive: keep `shopScope` as id string[] for backward compat AND add `shops: {shopId,name}[]` + `allShops` + `managerAccess`.

- [ ] **Step 1: Extract preserve helper and test it**

```typescript
// in auth.service.ts or firebaseRoleMapping.ts
export function shouldPreserveLocalRole(localRole: string): boolean {
  return localRole === 'STAFF' || localRole === 'MANAGER'
}
```

Test: `shouldPreserveLocalRole('STAFF') === true`, `'OWNER' === false`.

- [ ] **Step 2: Change exchange update branch**

Replace overwrite logic:

```typescript
} else {
  const data: { firebaseUid?: string; role?: Role } = {}
  if (!user.firebaseUid) data.firebaseUid = uid
  if (!shouldPreserveLocalRole(user.role) && user.role !== localRole) {
    data.role = localRole
  }
  if (Object.keys(data).length > 0) {
    user = await this.prisma.user.update({
      where: { id: user.id },
      data,
      include: { shopsOwned: { select: { id: true } }, staffIn: { select: { shopId: true } } }
    })
  }
}
```

- [ ] **Step 3: Update getProfile / token response to use resolveShopScope**

Include `managerAccess`, `allShops`, and shop list from `resolveShopScope`.

- [ ] **Step 4: Run auth tests + commit**

```bash
git add src/modules/auth
git commit -m "fix(auth): preserve STAFF/MANAGER on exchange and return shop scope"
```

---
