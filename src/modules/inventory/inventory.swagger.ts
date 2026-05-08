/**
 * @swagger
 * /api/inventory/update:
 *   post:
 *     tags: [Inventory]
 *     summary: Update inventory details (quantity and cost price) for a specific variant batch
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, variantId, quantity, costPrice]
 *             properties:
 *               shopId:
 *                 type: string
 *               variantId:
 *                 type: string
 *               batchNumber:
 *                 type: string
 *                 default: 'DEFAULT'
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *               costPrice:
 *                 type: number
 *                 minimum: 0
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 *       400:
 *         description: Validation error or invalid inputs
 *
 * /api/inventory/adjust:
 *   post:
 *     tags: [Inventory]
 *     summary: Adjust inventory quantity (increment or decrement)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, variantId, change, type]
 *             properties:
 *               shopId:
 *                 type: string
 *               variantId:
 *                 type: string
 *               batchNumber:
 *                 type: string
 *                 default: 'DEFAULT'
 *               change:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [PURCHASE, SALE, ADJUSTMENT, RETURN]
 *               referenceId:
 *                 type: string
 *               costPrice:
 *                 type: number
 *     responses:
 *       200:
 *         description: Inventory adjusted successfully
 *       400:
 *         description: Validation error or insufficient stock
 *
 * /api/inventory/shop/{shopId}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get all inventory items for a specific shop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of inventory items
 *
 * /api/inventory/transactions/shop/{shopId}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get inventory transaction history for a specific shop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of inventory transactions
 */
