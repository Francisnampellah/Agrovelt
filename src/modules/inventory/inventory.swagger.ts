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
 *                 description: "Deprecated: Use inventoryId internally. If provided, used for batch-specific updates."
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *               costPrice:
 *                 type: number
 *                 minimum: 0
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: "Used to order batches for FEFO (First Expiry First Out) logic."
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
 *                 description: "Deprecated: Use inventoryId internally. If provided, maps to a specific batch record."
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
 *
 * /api/inventory/shops/{shopId}/variants/{variantId}/batches:
 *   get:
 *     tags: [Inventory]
 *     summary: Get available batches for a variant in a specific shop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of available batches (quantity > 0)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Inventory'
 *
 * /api/inventory/bulk/update:
 *   post:
 *     tags: [Inventory]
 *     summary: Bulk update inventory from Excel file
 *     description: |
 *       Upload an Excel file (.xlsx) with inventory update data.
 *       Supports dry-run mode to validate without persisting.
 *       
 *       Expected columns: shopId, variantId, batchNumber, quantity, costPrice, expiryDate
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: dryRun
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Validate without updating (true for dry-run)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx)
 *     responses:
 *       200:
 *         description: Bulk update result
 *       400:
 *         description: Invalid file or validation errors
 *
 * /api/inventory/bulk/adjust:
 *   post:
 *     tags: [Inventory]
 *     summary: Bulk adjust inventory from Excel file
 *     description: |
 *       Upload an Excel file (.xlsx) with inventory adjustment data.
 *       Supports dry-run mode to validate without persisting.
 *       
 *       Expected columns: shopId, variantId, batchNumber, change, type, referenceId, costPrice
 *       Type must be one of: PURCHASE, SALE, ADJUSTMENT, RETURN
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: dryRun
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Validate without adjusting (true for dry-run)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx)
 *     responses:
 *       200:
 *         description: Bulk adjust result
 *       400:
 *         description: Invalid file or validation errors
 */
