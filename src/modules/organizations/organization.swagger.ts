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
 * /api/organizations/{id}/finance/summary:
 *   get:
 *     tags: [Organizations, CashFlow]
 *     summary: Category-level cash flow rollup for an organization
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Revenue, expenses, purchases, and refunds across every shop in the
 *       organization (or a specific subset via shopIds), for the given date
 *       range. Omitting from/to returns an all-time total. Supplying both
 *       enforces a 24-hour minimum span and a 3-month lookback limit.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: shopIds
 *         in: query
 *         schema: { type: string }
 *         description: Comma-separated shop UUIDs. Omit for the whole organization.
 *     responses:
 *       200:
 *         description: Finance summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue: { type: number }
 *                     salesCount: { type: integer }
 *                     totalExpenses: { type: number }
 *                     expenseCount: { type: integer }
 *                     totalPurchases: { type: number }
 *                     purchaseCount: { type: integer }
 *                     totalRefunds: { type: number }
 *                     refundCount: { type: integer }
 *                     netEstimate: { type: number }
 *                     stockUnitsOnHand: { type: integer }
 *                     lowStockCount: { type: integer }
 *       400:
 *         description: Invalid date range (span under 24h, more than 3 months back, or in the future)
 *       403:
 *         description: Access denied
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/finance/activity:
 *   get:
 *     tags: [Organizations, CashFlow]
 *     summary: Cash flow activity feed for an organization
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Individual cash flow entries across every shop in the organization
 *       (or a specific subset via shopIds), newest first. Same date-range
 *       rules as finance/summary.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: shopIds
 *         in: query
 *         schema: { type: string }
 *         description: Comma-separated shop UUIDs. Omit for the whole organization.
 *       - name: take
 *         in: query
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Cash flow entries, each including its shop
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/CashFlowEntry'
 *                       - type: object
 *                         properties:
 *                           shop:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               name: { type: string }
 *       400:
 *         description: Invalid date range
 *       403:
 *         description: Access denied
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/users:
 *   get:
 *     tags: [Organizations, Users]
 *     summary: List team members in an organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization users, each including their shop assignment if any
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Organization not found
 *
 *   post:
 *     tags: [Organizations, Users]
 *     summary: Create a team member directly in an organization
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Creates the account immediately with the supplied password — this
 *       is not an email invite, so the password must be relayed to the new
 *       team member out of band. Owner/Admin/SUPER_ADMIN only.
 *
 *       Note: this account is backend-native (its own email/password
 *       login), not linked to Firebase Auth.
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
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               role: { type: string, enum: [ADMIN, STAFF] }
 *     responses:
 *       201:
 *         description: User created
 *       403:
 *         description: Only owners and admins can manage team members
 *       404:
 *         description: Organization not found
 *
 * /api/organizations/{id}/users/{userId}/deactivate:
 *   put:
 *     tags: [Organizations, Users]
 *     summary: Deactivate a team member
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Soft-deletes access (isActive: false). Cannot deactivate yourself
 *       or the organization's OWNER. Owner/Admin/SUPER_ADMIN only.
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
 *         description: User deactivated
 *       400:
 *         description: Cannot deactivate self or the organization owner
 *       403:
 *         description: Only owners and admins can manage team members
 *       404:
 *         description: Organization or user not found
 */
