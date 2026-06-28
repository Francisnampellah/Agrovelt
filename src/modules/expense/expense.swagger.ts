/**
 * @swagger
 * /api/expenses:
 *   post:
 *     tags: [Expenses]
 *     summary: Create an expense
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, title, amount, date]
 *             properties:
 *               shopId: { type: string, format: uuid }
 *               title: { type: string }
 *               amount: { type: number, minimum: 0 }
 *               category: { type: string }
 *               date: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Expense created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Expense'
 *                 notification:
 *                   $ref: '#/components/schemas/NotificationItem'
 *       400:
 *         description: Invalid input
 *
 *   get:
 *     tags: [Expenses]
 *     summary: Get expenses for a shop
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of expenses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Expense'
 */
