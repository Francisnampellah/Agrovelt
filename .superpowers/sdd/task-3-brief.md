### Task 3: Org user management service (OWNER creates STAFF/MANAGER)

**Files:**
- Create: `src/modules/organizations/org-users.service.ts`
- Create: `src/modules/organizations/org-users.service.test.ts`
- Modify: `src/modules/organizations/types.ts` (add request types)

**Interfaces:**
- Consumes: `canManageUsers`, Prisma User/ShopStaff
- Produces:
  - `createOrgUser(actor, orgId, input)`
  - `listOrgUsers(orgId)`
  - `updateOrgUser(actor, orgId, userId, input)`
  - `deactivateOrgUser(actor, orgId, userId)`
  - Input type:
```typescript
export type CreateOrgUserInput = {
  name: string
  email: string
  password: string
  role: 'STAFF' | 'MANAGER'
  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS'
  shopId?: string
}
```

- [ ] **Step 1: Write failing service tests**

Cover:
1. STAFF without shopId → throws `/shopId is required/`
2. STAFF with shopId → user role STAFF, one ShopStaff, managerAccess null
3. MANAGER ALL_SHOPS with shopId → throws
4. MANAGER ONE_SHOP without shopId → throws
5. MANAGER ALL_SHOPS → managerAccess ALL_SHOPS, zero ShopStaff
6. Non-owner actor → throws `/Insufficient permissions/` or `/User management/`
7. Shop outside org → throws

Use bcrypt-compatible stub: inject prisma mock; hash can call real bcrypt or stub `passwordHash: 'hash'`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement org-users.service.ts**

Key create logic:

```typescript
import bcrypt from 'bcrypt'
import { PrismaClient, Role, ManagerAccess } from '@prisma/client'
import { AuthActor, canManageUsers } from '../auth/permissions'

export class OrgUsersService {
  constructor(private prisma: PrismaClient) {}

  async createOrgUser(actor: AuthActor, orgId: string, input: CreateOrgUserInput) {
    if (!canManageUsers(actor)) throw new Error('Insufficient permissions for user management')
    if (actor.role === 'OWNER' && actor.organizationId !== orgId) {
      throw new Error('Access denied to this organization')
    }

    if (input.role === 'STAFF') {
      if (!input.shopId) throw new Error('shopId is required for STAFF')
      if (input.managerAccess) throw new Error('managerAccess is not allowed for STAFF')
    }
    if (input.role === 'MANAGER') {
      if (!input.managerAccess) throw new Error('managerAccess is required for MANAGER')
      if (input.managerAccess === 'ONE_SHOP' && !input.shopId) {
        throw new Error('shopId is required for ONE_SHOP managers')
      }
      if (input.managerAccess === 'ALL_SHOPS' && input.shopId) {
        throw new Error('shopId is not allowed for ALL_SHOPS managers')
      }
    }

    if (input.shopId) {
      const shop = await this.prisma.shop.findFirst({
        where: { id: input.shopId, organizationId: orgId }
      })
      if (!shop) throw new Error('Shop not found in this organization')
    }

    const passwordHash = await bcrypt.hash(input.password, 10)

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role === 'STAFF' ? Role.STAFF : Role.MANAGER,
          organizationId: orgId,
          managerAccess:
            input.role === 'MANAGER'
              ? (input.managerAccess === 'ALL_SHOPS'
                  ? ManagerAccess.ALL_SHOPS
                  : ManagerAccess.ONE_SHOP)
              : null
        }
      })

      if (input.shopId) {
        await tx.shopStaff.create({
          data: {
            shopId: input.shopId,
            userId: user.id,
            role: input.role === 'MANAGER' ? 'MANAGER' : 'STAFF'
          }
        })
      }

      return user
    })
  }
}
```

Also implement `listOrgUsers` (include staffIn.shop + managerAccess), `updateOrgUser` (reassign shop / managerAccess with same validation; when switching to ALL_SHOPS delete ShopStaff rows; when STAFF/ONE_SHOP ensure single row), `deactivateOrgUser` (`isActive: false`).

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/organizations/org-users.service.ts src/modules/organizations/org-users.service.test.ts src/modules/organizations/types.ts
git commit -m "feat(org): add owner-scoped user create/list/update/deactivate service"
```

---
