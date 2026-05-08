/**
 * @swagger
 * /api/products/categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a new shared category
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 *       401:
 *         description: Unauthorized
 * 
 *   get:
 *     tags: [Categories]
 *     summary: Get all shared categories
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of categories
 *       401:
 *         description: Unauthorized
 * 
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, organizationId]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               unit:
 *                 type: string
 *               dosageInfo:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               isRestricted:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Product created
 * 
 *   get:
 *     tags: [Products]
 *     summary: Get all products
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of products
 * 
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 * 
 * /api/products/variants:
 *   post:
 *     tags: [Products]
 *     summary: Create a product variant
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, name, sku]
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *               sku:
 *                 type: string
 *     responses:
 *       201:
 *         description: Variant created
 *
 * /api/products/bulk/import:
 *   post:
 *     tags: [Products]
 *     summary: Bulk import products from Excel file
 *     description: |
 *       Upload an Excel file (.xlsx) with product data for bulk import.
 *       Supports dry-run mode to validate without persisting.
 *       
 *       Expected columns: name, description, categoryName, organizationId, unit, dosageInfo, manufacturer, isRestricted
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: dryRun
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Validate without importing (true for dry-run)
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
 *         description: Bulk import result with success/failure details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 totalRows:
 *                   type: integer
 *                 successCount:
 *                   type: integer
 *                 failureCount:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   description: Valid rows (only in dry-run mode)
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: integer
 *                       field:
 *                         type: string
 *                       value:
 *                         type: any
 *                       error:
 *                         type: string
 *       400:
 *         description: Invalid file or validation errors
 */
