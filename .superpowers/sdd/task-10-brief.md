### Task 10: End-to-end verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: all PASS including new auth/org/cashflow tests.

- [ ] **Step 2: Confirm prisma generate + migration present**

- [ ] **Step 3: Manual checklist (document in commit message if no e2e harness)**

1. OWNER creates STAFF with shopId → profile shopScope length 1  
2. STAFF cannot list other shops / cannot purchase / cannot add stock  
3. OWNER creates MANAGER ALL_SHOPS → funding OK  
4. OWNER creates MANAGER ONE_SHOP → funding 403; stock on other shop 403  
5. Exchange as existing STAFF does not become OWNER  

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "test(auth): verify role and shop scoping coverage"
```

---
