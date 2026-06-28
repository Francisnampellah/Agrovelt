/**
 * @swagger
 * /api/receipts:
 *   get:
 *     tags: [Receipts]
 *     summary: List receipts for a shop
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: shopId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ISSUED, VOIDED] }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Shop receipts
 *
 * /api/receipts/by-number/{receiptNumber}:
 *   get:
 *     tags: [Receipts]
 *     summary: Get receipt by receipt number
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: receiptNumber
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Receipt with full sale detail for printing
 *       404:
 *         description: Receipt not found
 *
 * /api/receipts/{receiptId}:
 *   get:
 *     tags: [Receipts]
 *     summary: Get receipt by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: receiptId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Receipt detail
 *
 * /api/receipts/{receiptId}/print:
 *   post:
 *     tags: [Receipts]
 *     summary: Mark receipt as printed
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: receiptId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Receipt marked printed
 *
 * /api/receipts/{receiptId}/void:
 *   post:
 *     tags: [Receipts]
 *     summary: Void a receipt
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: receiptId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Receipt voided
 *
 * /api/organizations/{organizationId}/receipts:
 *   get:
 *     tags: [Receipts, Organizations]
 *     summary: List receipts for an organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: organizationId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: shopId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ISSUED, VOIDED] }
 *     responses:
 *       200:
 *         description: Organization receipts
 */
