/**
 * @swagger
 * /api/sales:
 *   post:
 *     tags: [Sales]
 *     summary: Create a sale
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, items, paymentMethod]
 *             properties:
 *               shopId: { type: string, format: uuid }
 *               paymentMethod: { type: string, enum: [CASH, CARD, MOBILE] }
 *               discount: { type: number, minimum: 0 }
 *               tax: { type: number, minimum: 0 }
 *               total: { type: number, minimum: 0 }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [variantId, quantity]
 *                   properties:
 *                     variantId: { type: string, format: uuid }
 *                     quantity: { type: integer, minimum: 1 }
 *                     price: { type: number, minimum: 0 }
 *                     batchNumber: { type: string }
 *     responses:
 *       201:
 *         description: Sale created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Sale'
 *                 notification:
 *                   $ref: '#/components/schemas/NotificationItem'
 *                 receipt:
 *                   $ref: '#/components/schemas/Receipt'
 *       400:
 *         description: Invalid input or insufficient stock
 *
 *   get:
 *     tags: [Sales]
 *     summary: Get sales for a shop
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of sales
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sale'
 *
 * /api/sales/{saleId}:
 *   get:
 *     tags: [Sales]
 *     summary: Get sale by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: saleId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sale details
 *       404:
 *         description: Sale not found
 *
 * /api/sales/{saleId}/refund:
 *   post:
 *     tags: [Sales]
 *     summary: Refund a completed sale and restock inventory
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: saleId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refundedBy: { type: string, format: uuid, description: 'Defaults to authenticated user' }
 *     responses:
 *       200:
 *         description: Sale refunded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/Sale'
 *                 notification:
 *                   $ref: '#/components/schemas/NotificationItem'
 *                 receipt:
 *                   $ref: '#/components/schemas/Receipt'
 *       400:
 *         description: Cannot refund — already refunded or invalid sale ID
 */
