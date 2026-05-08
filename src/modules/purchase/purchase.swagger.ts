/**
 * @swagger
 * /api/purchases:
 *   post:
 *     tags: [Purchases]
 *     summary: Create a purchase (receive stock)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, createdBy, items]
 *             properties:
 *               shopId: { type: string }
 *               supplierId: { type: string }
 *               createdBy: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     variantId: { type: string }
 *                     quantity: { type: integer }
 *                     costPrice: { type: number }
 *     responses:
 *       201:
 *         description: Purchase created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Purchase'
 *
 *   get:
 *     tags: [Purchases]
 *     summary: Get purchases for a shop
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string }
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