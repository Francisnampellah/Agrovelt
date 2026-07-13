/**
 * @swagger
 * /api/organizations:
 *   post:
 *     tags: [Organizations]
 *     summary: Create organization and link authenticated user
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Requires authentication. Users without an organization are linked as OWNER
 *       when they create one.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug, email]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization created and user linked
 * 
 *   get:
 *     tags: [Organizations]
 *     summary: Get all organizations
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of organizations
 *       401:
 *         description: Unauthorized
 * 
 * /api/organizations/{id}:
 *   get:
 *     tags: [Organizations]
 *     summary: Get organization by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization details
 *       404:
 *         description: Organization not found
 * 
 *   put:
 *     tags: [Organizations]
 *     summary: Update organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organization updated
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/sales:
 *   get:
 *     tags: [Organizations]
 *     summary: List sales for an organization
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Returns all sales across shops belonging to the organization.
 *       Accessible to organization members and SUPER_ADMIN.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization sales
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sale'
 *       403:
 *         description: Access denied to this organization
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/expenses:
 *   get:
 *     tags: [Organizations]
 *     summary: List expenses for an organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization expenses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Expense'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/purchases:
 *   get:
 *     tags: [Organizations]
 *     summary: List purchases for an organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization purchases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Purchase'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/notifications:
 *   get:
 *     tags: [Organizations, Notifications]
 *     summary: Activity notifications for an organization
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Merged feed of recent sales, purchases, expenses, and refunds
 *       across all shops in the organization, sorted newest first.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *     responses:
 *       200:
 *         description: Notification feed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NotificationItem'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/shops:
 *   get:
 *     tags: [Organizations, Shops]
 *     summary: List shops for an organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization shops
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shop'
 *
 * /api/organizations/{id}/stock:
 *   get:
 *     tags: [Organizations, Inventory]
 *     summary: Stock levels across all organization shops
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Inventory batches with shop and variant details
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
 * /api/organizations/{id}/stock/summary:
 *   get:
 *     tags: [Organizations, Inventory]
 *     summary: Aggregated stock summary by product variant
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: lowStockThreshold
 *         in: query
 *         schema: { type: integer, minimum: 0, default: 10 }
 *     responses:
 *       200:
 *         description: Variant totals and per-shop breakdown
 *
 * /api/organizations/{id}/stock/transactions:
 *   get:
 *     tags: [Organizations, Inventory]
 *     summary: Inventory movement history across organization shops
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: shopId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *       - name: cursor
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Inventory transactions
 *
 * /api/organizations/{id}/users:
 *   post:
 *     tags: [Organizations, Users]
 *     summary: Create an organization user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, phoneNumber, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               phoneNumber: { type: string, minLength: 9, description: Written to Firestore users/{uid}.phone_no }
 *               role: { type: string, enum: [STAFF, MANAGER] }
 *               managerAccess: { type: string, enum: [ONE_SHOP, ALL_SHOPS] }
 *               shopId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Organization user created (also provisions Firebase Auth + Firestore agrovet profile)
 *       400:
 *         description: Invalid input or assignment
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Shop not found in organization
 *   get:
 *     tags: [Organizations, Users]
 *     summary: List organization users
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization users
 *       403:
 *         description: Insufficient permissions
 *
 * /api/organizations/{id}/users/{userId}:
 *   patch:
 *     tags: [Organizations, Users]
 *     summary: Update an organization user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [STAFF, MANAGER] }
 *               managerAccess: { type: string, enum: [ONE_SHOP, ALL_SHOPS] }
 *               shopId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization user updated
 *       400:
 *         description: Invalid input or assignment
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User or shop not found
 *
 * /api/organizations/{id}/users/{userId}/deactivate:
 *   post:
 *     tags: [Organizations, Users]
 *     summary: Deactivate an organization user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization user deactivated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 */
