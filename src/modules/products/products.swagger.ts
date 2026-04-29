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
 */
