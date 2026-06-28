/**
 * @swagger
 * /api/purchases:
 *   post:
 *     tags: [Purchases]
 *     summary: Create a purchase (receive stock)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, items]
 *             properties:
 *               shopId: { type: string, format: uuid }
 *               supplierId: { type: string, format: uuid }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [variantId, quantity, costPrice]
 *                   properties:
 *                     variantId: { type: string, format: uuid }
 *                     quantity: { type: integer, minimum: 1 }
 *                     costPrice: { type: number, minimum: 0 }
 *                     batchNumber: { type: string }
 *                     expiryDate: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Purchase created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Purchase'
 *                 notification:
 *                   $ref: '#/components/schemas/NotificationItem'
 *       400:
 *         description: Invalid input
 *
 *   get:
 *     tags: [Purchases]
 *     summary: Get purchases for a shop
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of purchases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Purchase'
 */
