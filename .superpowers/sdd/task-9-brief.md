### Task 9: Register validation + swagger + STAFF multi-shop cleanup note

**Files:**
- Modify: `src/modules/auth/auth.controller.ts` (allow MANAGER in role isIn if register still accepts role — prefer **reject** public register creating MANAGER; only org user API creates MANAGER/STAFF with shop)
- Modify: `src/config/swagger.ts` Role enums
- Optional script: `scripts/audit-multi-shop-staff.ts` listing STAFF with >1 ShopStaff

- [ ] **Step 1: Restrict public register**

Public `POST /api/auth/register` must not create MANAGER. If role STAFF without shopId, either reject or keep legacy but log deprecation — **prefer reject STAFF without shopId** on register; owners use org user API.

- [ ] **Step 2: Update swagger Role enum to include MANAGER + document org user endpoints**

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.controller.ts src/config/swagger.ts scripts/audit-multi-shop-staff.ts
git commit -m "docs(auth): document MANAGER role and tighten public register"
```

---
