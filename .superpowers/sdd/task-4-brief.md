### Task 4: Org user HTTP routes + controller

**Files:**
- Create: `src/modules/organizations/org-users.controller.ts`
- Modify: `src/modules/organizations/index.ts`
- Modify: `src/routes/organizations.ts`
- Modify: `src/modules/organizations/organization.swagger.ts` (document endpoints)

**Interfaces:**
- Consumes: `OrgUsersService`, `AuthMiddleware.authenticate`
- Produces routes:
  - `POST /api/organizations/:id/users`
  - `GET /api/organizations/:id/users`
  - `PATCH /api/organizations/:id/users/:userId`
  - `POST /api/organizations/:id/users/:userId/deactivate`

- [ ] **Step 1: Implement controller with express-validator**

Validation highlights:
- `role` isIn `['STAFF','MANAGER']`
- `managerAccess` optional isIn `['ONE_SHOP','ALL_SHOPS']`
- `shopId` optional UUID
- `password` isLength min 8

Build `AuthActor` from `req.user` + load `managerAccess` from DB if needed:

```typescript
const dbUser = await prisma.user.findUnique({
  where: { id: req.user!.userId },
  select: { managerAccess: true, organizationId: true }
})
const actor = {
  userId: req.user!.userId,
  role: req.user!.role,
  organizationId: req.user!.organizationId ?? dbUser?.organizationId,
  ...(dbUser?.managerAccess ? { managerAccess: dbUser.managerAccess } : {})
}
```

Map errors: permission → 403, not found → 404, validation → 400.

- [ ] **Step 2: Wire routes in `src/routes/organizations.ts`**

Place **before** `/organizations/:id` SUPER_ADMIN routes if path conflicts; use `:id` consistently as orgId:

```typescript
router.post('/organizations/:id/users', authMiddleware.authenticate, orgUsersController.createValidation, orgUsersController.create)
router.get('/organizations/:id/users', authMiddleware.authenticate, orgUsersController.list)
router.patch('/organizations/:id/users/:userId', authMiddleware.authenticate, orgUsersController.updateValidation, orgUsersController.update)
router.post('/organizations/:id/users/:userId/deactivate', authMiddleware.authenticate, orgUsersController.deactivate)
```

- [ ] **Step 3: Manual smoke via unit-level controller not required; ensure TypeScript compiles for new files**

Run: `npx tsc --noEmit 2>&1 | Select-String "org-users"`  
Expected: no org-users errors (ignore pre-existing cors error).

- [ ] **Step 4: Commit**

```bash
git add src/modules/organizations/org-users.controller.ts src/modules/organizations/index.ts src/routes/organizations.ts src/modules/organizations/organization.swagger.ts
git commit -m "feat(org): expose OWNER user management HTTP APIs"
```

---
