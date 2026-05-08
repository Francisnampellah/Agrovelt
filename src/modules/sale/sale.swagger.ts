/**
 * @swagger
 * /api/sales:
 *   post:
 *     tags: [Sales]
 *     summary: Create a sale
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, createdBy, items, paymentMethod]
 *             properties:
 *               shopId: { type: string }
 *               createdBy: { type: string }
 *               paymentMethod: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     variantId: { type: string }
 *                     quantity: { type: integer }
 *                     price: { type: number }
 *     responses:
 *       201:
 *         description: Sale created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sale'
 *
 *   get:
 *     tags: [Sales]
 *     summary: Get sales for a shop
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string }
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
 * /api/sales/{saleId}/refund:
 *   post:
 *     tags: [Sales]
 *     summary: Refund a completed sale and restock inventory
 *     parameters:
 *       - name: saleId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refundedBy]
 *             properties:
 *               refundedBy: { type: string }
 *     responses:
 *       200:
 *         description: Sale refunded successfully, inventory restored and cashflow adjusted
 *       400:
 *         description: Cannot refund a sale that is already refunded or invalid sale ID
 */
