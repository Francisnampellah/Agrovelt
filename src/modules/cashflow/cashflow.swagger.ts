/**
 * @swagger
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