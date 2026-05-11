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
 *                   required: [variantId, quantity, costPrice]
 *                   properties:
 *                     variantId: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *                     costPrice: { type: number, minimum: 0 }
 *                     inventoryId: { type: string, description: "Optionally select an existing inventory/batch ID to top up. If omitted, a new batch is created." }
 *                     batchNumber: { type: string, description: "Manual batch number. Only used if inventoryId is omitted. If both are omitted, a batch number is auto-generated." }
 *                     expiryDate: { type: string, format: date-time, description: "Recommended for FEFO tracking." }
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