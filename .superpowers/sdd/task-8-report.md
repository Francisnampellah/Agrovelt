# Task 8: Org funding endpoint — Report

## Status

Completed and committed.

## Implementation

- Added `CashFlowService.recordFunding(shopId, amount, recordedBy, note?)`, which creates an `IN` / `ADJUSTMENT` cash-flow entry and defaults its note to `Organization funding`.
- Added authenticated `POST /api/cashflow/funding` with `{ shopId, amount, note? }` validation.
- The endpoint denies actors failing `canAddOrgFunding`, then checks that the selected shop is in the actor's scope before recording funding.

## Tests

- Added funding service coverage for the persisted default fields.
- Verified that ONE_SHOP managers are denied while ALL_SHOPS managers and OWNERs are allowed.
- `npm test` passed: 40 tests.
- `npm run build` passed.

## Commit

`8320e0c feat(cashflow): add org funding endpoint with manager ALL_SHOPS gate`

## Concerns

None. The report and pre-existing SDD artifacts remain untracked as requested by the task commit scope.
