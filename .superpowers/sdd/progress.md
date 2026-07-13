# SDD Progress — user-shop-roles

Branch: feat/user-shop-roles
Started: 2026-07-13


Task 1: complete (commits a42bb9d..d0b0262, review clean)

Task 2: complete (commits d0b0262..9299d8c, review clean; minors: Db any, multi-shop staffIn union)

Task 3: complete (commits 9299d8c..105826e, review clean after listOrgUsers auth fix)

Task 4: complete (commits 105826e..46cfa4b, review clean)

Task 5: complete (commits 46cfa4b..27ac185, review clean)

Task 6: complete (commits 27ac185..fe29c72, review clean; minors: org report filtering deferred)

Task 7: complete (commits fe29c72..49c9174, review clean)

Task 8: complete (commits 49c9174..8320e0c, review clean)

Task 9: complete (commits 8320e0c..13b2d87, review clean after orphan STAFF fix)

Task 10: complete (commits 13b2d87..bb48483, verification documented; live migrate blocked no postgres)


## Minor findings roll-up (for final review)
- Task 2: Db typed as any; multi-shop staffIn union possible until app enforces single row
- Task 6: requireShopAccess maps all errors to 403; org sales/expenses/stock list filtering deferred
- Task 7: thin controller tests beyond sales; duplicate errorStatus helpers
- Task 8: no swagger for funding endpoint
- Task 9: residual unused shopId validator on register
- Task 10: live migrate + Firebase exchange e2e not run (no postgres)
Final review fix: 19747bd (passwordHash DTO, single-shop scope clamp, org report gates)

Final review: Ready to merge after read-API scope fix 32b4aaa

