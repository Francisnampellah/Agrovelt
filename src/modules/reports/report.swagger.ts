/**
 * @swagger
 * tags:
 *   - name: Reports
 *     description: Customizable Agrovet business reports (generate, list, fetch)
 *
 * components:
 *   schemas:
 *     BusinessReportInclude:
 *       type: object
 *       properties:
 *         summary: { type: boolean, default: true }
 *         cashMovement: { type: boolean, default: true }
 *         sales: { type: boolean, default: false }
 *         refunds: { type: boolean, default: false }
 *         expenses: { type: boolean, default: false }
 *         purchases: { type: boolean, default: false }
 *         funding: { type: boolean, default: false }
 *         inventorySnapshot: { type: boolean, default: false }
 *         productMovements: { type: boolean, default: false }
 *         topProducts: { type: boolean, default: true }
 *         receipts: { type: boolean, default: false }
 *         breakdownByShop: { type: boolean, default: false }
 *         breakdownByCategory: { type: boolean, default: false }
 *         breakdownByPaymentMethod: { type: boolean, default: false }
 *         timeline: { type: boolean, default: true }
 *     BusinessReportFilters:
 *       type: object
 *       properties:
 *         transactionTypes:
 *           type: array
 *           items:
 *             type: string
 *             enum: [SALE, REFUND, EXPENSE, PURCHASE, FUNDING, ADJUSTMENT, RETURN, TRANSFER, LOSS, EXPIRED]
 *         paymentMethods:
 *           type: array
 *           items:
 *             type: string
 *             enum: [CASH, CARD, MOBILE]
 *         productIds:
 *           type: array
 *           items: { type: string, format: uuid }
 *         variantIds:
 *           type: array
 *           items: { type: string, format: uuid }
 *         categoryIds:
 *           type: array
 *           items: { type: string, format: uuid }
 *         expenseCategories:
 *           type: array
 *           items: { type: string }
 *         minAmount: { type: number, nullable: true }
 *         maxAmount: { type: number, nullable: true }
 *         onlyLowStock: { type: boolean, default: false }
 *         lowStockThreshold: { type: number, default: 10 }
 *     BusinessReportLimits:
 *       type: object
 *       properties:
 *         topProducts: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *         recentMovements: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *         timelinePoints: { type: integer, minimum: 1, maximum: 366, default: 31 }
 *     BusinessReportSort:
 *       type: object
 *       properties:
 *         movements: { type: string, enum: [ASC, DESC], default: DESC }
 *         topProductsBy: { type: string, enum: [REVENUE, UNITS], default: REVENUE }
 *     GenerateBusinessReportRequest:
 *       type: object
 *       required: [from, to]
 *       properties:
 *         from:
 *           type: string
 *           format: date-time
 *           example: 2026-07-01T00:00:00.000Z
 *         to:
 *           type: string
 *           format: date-time
 *           example: 2026-07-17T23:59:59.999Z
 *         shopIds:
 *           type: array
 *           description: Optional. Empty/omitted = all shops in caller scope.
 *           items: { type: string, format: uuid }
 *         timezone:
 *           type: string
 *           default: Africa/Dar_es_Salaam
 *         groupBy:
 *           type: string
 *           enum: [DAY, WEEK, MONTH, SHOP, NONE]
 *           default: DAY
 *         currency:
 *           type: string
 *           default: TZS
 *           description: Amounts are decimal TZS floats (not cents).
 *         include:
 *           $ref: '#/components/schemas/BusinessReportInclude'
 *         filters:
 *           $ref: '#/components/schemas/BusinessReportFilters'
 *         limits:
 *           $ref: '#/components/schemas/BusinessReportLimits'
 *         sort:
 *           $ref: '#/components/schemas/BusinessReportSort'
 *     BusinessReportError:
 *       type: object
 *       properties:
 *         error: { type: string }
 *         code:
 *           type: string
 *           example: REPORT_RANGE_TOO_LARGE
 *         details:
 *           type: object
 *           additionalProperties: true
 *     BusinessReportMeta:
 *       type: object
 *       properties:
 *         reportId: { type: string, format: uuid }
 *         organizationId: { type: string, format: uuid }
 *         generatedAt: { type: string, format: date-time }
 *         from: { type: string, format: date-time }
 *         to: { type: string, format: date-time }
 *         timezone: { type: string }
 *         shopIds:
 *           type: array
 *           items: { type: string, format: uuid }
 *         shopNames:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               shopId: { type: string, format: uuid }
 *               name: { type: string }
 *         generatedBy:
 *           type: object
 *           properties:
 *             userId: { type: string, format: uuid }
 *             role: { type: string }
 *         currency: { type: string }
 *         filtersApplied: { type: object }
 *         knownLimitations:
 *           type: object
 *           properties:
 *             inventorySnapshot: { type: string, example: CURRENT_STOCK_ONLY }
 *             amounts: { type: string, example: DECIMAL_TZS_FLOAT }
 *     BusinessReportSummary:
 *       type: object
 *       properties:
 *         revenue: { type: number }
 *         refunds: { type: number }
 *         expenses: { type: number }
 *         purchases: { type: number }
 *         funding: { type: number }
 *         cashIn: { type: number }
 *         cashOut: { type: number }
 *         netCash: { type: number }
 *         salesCount: { type: integer }
 *         refundCount: { type: integer }
 *         expenseCount: { type: integer }
 *         purchaseCount: { type: integer }
 *         stockValue: { type: number }
 *         stockUnits: { type: integer }
 *         skuCount: { type: integer }
 *         zeroStockCount: { type: integer }
 *         lowStockCount: { type: integer }
 *     BusinessReportPayload:
 *       type: object
 *       description: |
 *         Sections with include.X=false are omitted (not empty stubs).
 *         Money fields are decimal TZS floats.
 *       properties:
 *         meta:
 *           $ref: '#/components/schemas/BusinessReportMeta'
 *         summary:
 *           $ref: '#/components/schemas/BusinessReportSummary'
 *         cashMovement:
 *           type: object
 *           properties:
 *             in:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type: { type: string }
 *                   amount: { type: number }
 *                   count: { type: integer }
 *             out:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type: { type: string }
 *                   amount: { type: number }
 *                   count: { type: integer }
 *         breakdowns:
 *           type: object
 *           properties:
 *             byPaymentMethod:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   method: { type: string, enum: [CASH, CARD, MOBILE] }
 *                   amount: { type: number }
 *                   count: { type: integer }
 *             byShop:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   shopId: { type: string, format: uuid }
 *                   shopName: { type: string, nullable: true }
 *                   revenue: { type: number }
 *                   salesCount: { type: integer }
 *             byCategory:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   category: { type: string }
 *                   amount: { type: number }
 *                   count: { type: integer }
 *         timeline:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               periodStart: { type: string, format: date-time }
 *               periodEnd: { type: string, format: date-time }
 *               revenue: { type: number }
 *               expenses: { type: number }
 *               purchases: { type: number }
 *               refunds: { type: number }
 *               net: { type: number }
 *         topProducts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               productId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid }
 *               name: { type: string }
 *               sku: { type: string }
 *               unitsSold: { type: integer }
 *               revenue: { type: number }
 *               stock: { type: integer }
 *               stockValue: { type: number }
 *         inventorySnapshot:
 *           type: object
 *           properties:
 *             asOf: { type: string, format: date-time }
 *             semantics: { type: string, example: CURRENT_STOCK }
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   shopId: { type: string, format: uuid }
 *                   variantId: { type: string, format: uuid }
 *                   productId: { type: string, format: uuid }
 *                   productName: { type: string }
 *                   sku: { type: string }
 *                   quantity: { type: integer }
 *                   costPrice: { type: number }
 *                   stockValue: { type: number }
 *         productMovements:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               at: { type: string, format: date-time }
 *               type: { type: string }
 *               shopId: { type: string, format: uuid }
 *               shopName: { type: string, nullable: true }
 *               productName: { type: string }
 *               variantId: { type: string, format: uuid }
 *               quantity: { type: integer }
 *               amount: { type: number }
 *               referenceId: { type: string, nullable: true }
 *               referenceType: { type: string }
 *         transactions:
 *           type: object
 *           properties:
 *             sales: { type: array, items: { type: object } }
 *             refunds: { type: array, items: { type: object } }
 *             expenses: { type: array, items: { type: object } }
 *             purchases: { type: array, items: { type: object } }
 *             funding: { type: array, items: { type: object } }
 *         receipts:
 *           type: array
 *           items: { type: object }
 *     BusinessReportListItem:
 *       type: object
 *       properties:
 *         reportId: { type: string, format: uuid }
 *         organizationId: { type: string, format: uuid }
 *         from: { type: string, format: date-time }
 *         to: { type: string, format: date-time }
 *         timezone: { type: string }
 *         currency: { type: string }
 *         shopIds:
 *           type: array
 *           items: { type: string, format: uuid }
 *         generatedAt: { type: string, format: date-time }
 *         generatedBy:
 *           type: object
 *           properties:
 *             userId: { type: string, format: uuid }
 *             name: { type: string }
 *             role: { type: string }
 *
 * /api/organizations/{id}/reports/generate:
 *   post:
 *     tags: [Reports, Organizations]
 *     summary: Generate a customizable business report
 *     description: |
 *       Computes a scoped business report, persists it, and returns the payload.
 *       STAFF is forbidden. MANAGER ONE_SHOP is limited to assigned shops.
 *       Omitted shopIds resolves to the caller's shop scope.
 *       False include sections are omitted from the response.
 *       Inventory snapshot is current stock only (not historical as-of `to`).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Organization UUID
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateBusinessReportRequest'
 *           examples:
 *             cashLast7Days:
 *               summary: Cash only, last 7 days, all allowed shops
 *               value:
 *                 from: 2026-07-10T00:00:00.000Z
 *                 to: 2026-07-17T23:59:59.999Z
 *                 timezone: Africa/Dar_es_Salaam
 *                 groupBy: DAY
 *                 include:
 *                   summary: true
 *                   cashMovement: true
 *                   timeline: true
 *                   topProducts: false
 *                   inventorySnapshot: false
 *                   productMovements: false
 *                   breakdownByPaymentMethod: true
 *                 limits:
 *                   timelinePoints: 7
 *             inventoryOneShop:
 *               summary: Inventory + movements, one shop, last 30 days
 *               value:
 *                 from: 2026-06-17T00:00:00.000Z
 *                 to: 2026-07-17T23:59:59.999Z
 *                 shopIds: [11111111-1111-1111-1111-111111111111]
 *                 include:
 *                   summary: true
 *                   inventorySnapshot: true
 *                   productMovements: true
 *                   topProducts: true
 *                   cashMovement: false
 *                   timeline: false
 *                 filters:
 *                   onlyLowStock: false
 *                   lowStockThreshold: 10
 *                   transactionTypes: [SALE, PURCHASE, ADJUSTMENT, RETURN, TRANSFER]
 *                 limits:
 *                   topProducts: 10
 *                   recentMovements: 50
 *             fullReport:
 *               summary: Full report with payment-method breakdown
 *               value:
 *                 from: 2026-07-01T00:00:00.000Z
 *                 to: 2026-07-17T23:59:59.999Z
 *                 groupBy: DAY
 *                 include:
 *                   summary: true
 *                   cashMovement: true
 *                   sales: true
 *                   refunds: true
 *                   expenses: true
 *                   purchases: true
 *                   funding: true
 *                   inventorySnapshot: true
 *                   productMovements: true
 *                   topProducts: true
 *                   breakdownByShop: true
 *                   breakdownByCategory: true
 *                   breakdownByPaymentMethod: true
 *                   timeline: true
 *                 limits:
 *                   topProducts: 10
 *                   recentMovements: 50
 *                   timelinePoints: 31
 *     responses:
 *       201:
 *         description: Report generated and persisted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/BusinessReportPayload'
 *       400:
 *         description: Validation or bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 *       403:
 *         description: STAFF or shop out of scope
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 *       422:
 *         description: Range too large or no shops in scope
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 *
 * /api/organizations/{id}/reports:
 *   get:
 *     tags: [Reports, Organizations]
 *     summary: List recent business reports for an organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Recent report metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BusinessReportListItem'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 *
 * /api/organizations/{id}/reports/{reportId}:
 *   get:
 *     tags: [Reports, Organizations]
 *     summary: Fetch a previously generated business report
 *     description: Returns the frozen payload snapshot from generate time.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: reportId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stored report payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/BusinessReportPayload'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 *       404:
 *         description: Organization or report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessReportError'
 */
export {}
