/**
 * @swagger
 * /api/cashflow/funding:
 *   post:
 *     tags: [CashFlow]
 *     summary: Record an owner/manager cash injection into a shop
 *     description: |
 *       Restricted to the org OWNER, a platform admin, or an ALL_SHOPS
 *       manager (see canAddOrgFunding) - a ONE_SHOP manager cannot fund
 *       shops even within their own scope.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, amount]
 *             properties:
 *               shopId: { type: string, format: uuid }
 *               amount: { type: number, exclusiveMinimum: 0 }
 *               note: { type: string }
 *     responses:
 *       201:
 *         description: Cash flow entry recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/CashFlowEntry'
 *       403:
 *         description: Insufficient permissions to record organization funding
 *       400:
 *         description: Invalid input or shop outside the actor's scope
 *
 * /api/cashflow/summary:
 *   get:
 *     tags: [CashFlow]
 *     summary: Get cash flow summary for a shop between two dates
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Cash flow summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalIn:
 *                   type: number
 *                 totalOut:
 *                   type: number
 *                 net:
 *                   type: number
 *                 breakdown:
 *                   type: object
 *       400:
 *         $ref: '#/components/schemas/Error'
 *
 * /api/cashflow/entries:
 *   get:
 *     tags: [CashFlow]
 *     summary: List cash flow entries for a shop
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: direction
 *         in: query
 *         schema: { type: string, enum: ['IN','OUT'] }
 *       - name: category
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cash flow entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CashFlowEntry'
 */