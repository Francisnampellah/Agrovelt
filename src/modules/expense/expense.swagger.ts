/**
 * @swagger
 * /api/expenses:
 *   post:
 *     tags: [Expenses]
 *     summary: Create an expense
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, title, amount, date, recordedBy]
 *             properties:
 *               shopId: { type: string }
 *               title: { type: string }
 *               amount: { type: number }
 *               category: { type: string }
 *               date: { type: string, format: date-time }
 *               recordedBy: { type: string }
 *     responses:
 *       201:
 *         description: Expense created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Expense'
 *
 *   get:
 *     tags: [Expenses]
 *     summary: Get expenses for a shop
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string }
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