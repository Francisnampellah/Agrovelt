# Business Report API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customizable, persisted Business Report API under `/api/organizations/{id}/reports`.

**Architecture:** New `src/modules/reports` module with scope resolver, section builders, Prisma aggregations, and `BusinessReport` persistence. Wired into organization routes.

**Tech Stack:** Express, Prisma, express-validator, node:test

## Global Constraints

- Amounts are decimal Float TZS (not cents)
- Payment methods: CASH | CARD | MOBILE only
- Max date range: 366 days
- STAFF cannot generate reports
- Omit false `include` sections from response
- Inventory snapshot = current stock only

---

### Task 1: Schema + permission helper

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260717120000_add_business_reports/migration.sql`
- Modify: `src/modules/auth/permissions.ts`
- Test: `src/modules/auth/permissions.test.ts` (extend)

- [ ] Add `BusinessReport` model + Organization/User relations
- [ ] Add `canGenerateBusinessReport(actor)` (OWNER, MANAGER, ADMIN, SUPER_ADMIN)
- [ ] Run prisma generate

### Task 2: Report types, errors, scope, service

**Files:**
- Create: `src/modules/reports/*`
- Test: `src/modules/reports/report.service.test.ts`

- [ ] DTOs + validation helpers
- [ ] Resolve shop scope for report (scope-aware default)
- [ ] Generate with include toggles; persist; list; get

### Task 3: Controller + routes + docs

**Files:**
- Create: `src/modules/reports/report.controller.ts`
- Modify: `src/routes/organizations.ts`, `src/modules/organizations/index.ts`
- Create: `docs/mobile/business-report-api.md`

- [ ] Wire POST generate, GET list, GET by id
- [ ] Mobile doc with three examples
