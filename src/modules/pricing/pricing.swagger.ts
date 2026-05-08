/**
 * @swagger
 * /api/pricing/resolve:
 *   get:
 *     tags: [Pricing]
 *     summary: Resolve selling price for a variant in a shop
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: variantId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resolved selling price
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 price:
 *                   type: number
 *       400:
 *         $ref: '#/components/schemas/Error'
 *
 * /api/pricing/shops/{shopId}/variants/{variantId}:
 *   patch:
 *     tags: [Pricing]
 *     summary: Update shop-specific selling price for a variant
 *     parameters:
 *       - name: shopId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: variantId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPrice, changedBy]
 *             properties:
 *               newPrice:
 *                 type: number
 *               minSellingPrice:
 *                 type: number
 *               reason:
 *                 type: string
 *               changedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Price updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShopVariantPrice'
 */