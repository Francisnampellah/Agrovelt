### Task 6: Update requireShopAccess + filter shop lists

**Files:**
- Modify: `src/modules/auth/auth.middleware.ts`
- Modify: `src/modules/shops/shop.controller.ts`
- Modify: `src/modules/organizations/organization.controller.ts` (`getShops`, stock/sales/expenses if they list org-wide)

- [ ] **Step 1: Rewrite requireShopAccess**

Use `assertShopInScope` after loading actor `managerAccess` from DB. Allow SUPER_ADMIN and ADMIN. For OWNER/MANAGER ALL_SHOPS ensure shop.organizationId matches user.organizationId.

- [ ] **Step 2: Filter `ShopController.getAll`**

After fetching org shops, if role is STAFF or MANAGER ONE_SHOP, filter to `resolveShopScope.shopIds`.

- [ ] **Step 3: Filter org `getShops` similarly**

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/auth.middleware.ts src/modules/shops/shop.controller.ts src/modules/organizations/organization.controller.ts
git commit -m "feat(auth): enforce shop scope on shop access and listings"
```

---
