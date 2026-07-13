### Task 8: Org funding endpoint

**Files:**
- Modify: `src/modules/cashflow/cashflow.service.ts`
- Modify: `src/routes/cashflow.ts`
- Create: `src/modules/cashflow/funding.test.ts` (service permission integration with mock)

Spec: OWNER or MANAGER ALL_SHOPS records funding as cash IN / ADJUSTMENT against a chosen shop (use main shop or body `shopId` that must be in org). Funding is org-level capability; still needs a shopId for `CashFlowEntry` FK.

- [ ] **Step 1: Add `recordFunding(shopId, amount, recordedBy, note?)`**

Uses direction `IN`, category `ADJUSTMENT`, note default `Organization funding`.

- [ ] **Step 2: Route `POST /api/cashflow/funding`**

Body: `{ shopId, amount, note? }`  
Check `canAddOrgFunding(actor)` then `assertShopInScope` (OWNER/ALL_SHOPS always in scope for org shops).

- [ ] **Step 3: Test ONE_SHOP manager denied; ALL_SHOPS allowed**

- [ ] **Step 4: Commit**

```bash
git add src/modules/cashflow src/routes/cashflow.ts
git commit -m "feat(cashflow): add org funding endpoint with manager ALL_SHOPS gate"
```

---
