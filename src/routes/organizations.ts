import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createOrganizationModule, OrganizationModuleDeps } from '../modules/organizations'
import { createReportsModule } from '../modules/reports'

const router = Router()

export function createOrganizationRoutes(
  prisma: PrismaClient,
  deps?: OrganizationModuleDeps
) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { organizationController, orgUsersController } = createOrganizationModule(prisma, deps)
  const { reportController } = createReportsModule(prisma)

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Authenticated users without an organization can create one.
 *       The current user is automatically linked as OWNER.
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
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: ABC Agricultural Ltd
 *               slug:
 *                 type: string
 *                 example: abc-agri
 *               email:
 *                 type: string
 *                 example: contact@abcagri.com
 *               phoneNumber:
 *                 type: string
 *                 example: "+254712345678"
 *     responses:
 *       201:
 *         description: Organization created and linked to the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     organization:
 *                       $ref: '#/components/schemas/Organization'
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 */
  router.post(
    '/organizations',
    authMiddleware.authenticate,
    organizationController.createValidation,
    organizationController.create
  )

  router.get(
    '/organizations/:id/sales',
    authMiddleware.authenticate,
    organizationController.getSales
  )

  router.get(
    '/organizations/:id/expenses',
    authMiddleware.authenticate,
    organizationController.getExpenses
  )

  router.get(
    '/organizations/:id/purchases',
    authMiddleware.authenticate,
    organizationController.getPurchases
  )

  router.get(
    '/organizations/:id/notifications',
    authMiddleware.authenticate,
    organizationController.notificationsValidation,
    organizationController.getNotifications
  )

  router.get(
    '/organizations/:id/shops',
    authMiddleware.authenticate,
    organizationController.getShops
  )

  router.get(
    '/organizations/:id/stock/summary',
    authMiddleware.authenticate,
    organizationController.stockSummaryValidation,
    organizationController.getStockSummary
  )

  router.get(
    '/organizations/:id/stock/transactions',
    authMiddleware.authenticate,
    organizationController.stockTransactionsValidation,
    organizationController.getStockTransactions
  )

  router.get(
    '/organizations/:id/stock',
    authMiddleware.authenticate,
    organizationController.getStock
  )

  router.get(
    '/organizations/:id/finance/summary',
    authMiddleware.authenticate,
    organizationController.financeQueryValidation,
    organizationController.getFinanceSummary
  )

  router.get(
    '/organizations/:id/finance/activity',
    authMiddleware.authenticate,
    organizationController.financeQueryValidation,
    organizationController.getFinanceActivity
  )

  /**
   * @swagger
   * /api/organizations/{id}/reports/generate:
   *   post:
   *     tags: [Reports, Organizations]
   *     summary: Generate a customizable business report
   *     description: |
   *       Computes and persists a scoped business report.
   *       STAFF is forbidden. Omitted shopIds resolves to the caller's shop scope.
   *       False include sections are omitted from the response.
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
   *             $ref: '#/components/schemas/GenerateBusinessReportRequest'
   *     responses:
   *       201:
   *         description: Report generated and persisted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/BusinessReportPayload'
   *       400:
   *         description: Validation failed
   *       403:
   *         description: STAFF or shop out of scope
   *       404:
   *         description: Organization not found
   *       422:
   *         description: Range too large or no shops in scope
   *
   * /api/organizations/{id}/reports:
   *   get:
   *     tags: [Reports, Organizations]
   *     summary: List recent business reports
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string, format: uuid }
   *       - name: limit
   *         in: query
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
   *     responses:
   *       200:
   *         description: Recent report metadata
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BusinessReportListItem'
   *       403:
   *         description: Insufficient permissions
   *
   * /api/organizations/{id}/reports/{reportId}:
   *   get:
   *     tags: [Reports, Organizations]
   *     summary: Fetch a previously generated business report
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string, format: uuid }
   *       - name: reportId
   *         in: path
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Stored report payload
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/BusinessReportPayload'
   *       404:
   *         description: Report not found
   */
  router.post(
    '/organizations/:id/reports/generate',
    authMiddleware.authenticate,
    reportController.generateValidation,
    reportController.generate
  )

  router.get(
    '/organizations/:id/reports',
    authMiddleware.authenticate,
    reportController.listValidation,
    reportController.list
  )

  router.get(
    '/organizations/:id/reports/:reportId',
    authMiddleware.authenticate,
    reportController.getValidation,
    reportController.getById
  )

  const canManageOrgUsers = authMiddleware.authorize('OWNER', 'ADMIN', 'SUPER_ADMIN')

  router.post(
    '/organizations/:id/users',
    authMiddleware.authenticate,
    canManageOrgUsers,
    orgUsersController.createValidation,
    orgUsersController.create
  )

  router.get(
    '/organizations/:id/users',
    authMiddleware.authenticate,
    canManageOrgUsers,
    orgUsersController.list
  )

  router.patch(
    '/organizations/:id/users/:userId',
    authMiddleware.authenticate,
    canManageOrgUsers,
    orgUsersController.updateValidation,
    orgUsersController.update
  )

  router.post(
    '/organizations/:id/users/:userId/deactivate',
    authMiddleware.authenticate,
    canManageOrgUsers,
    orgUsersController.deactivate
  )

/**
 * @swagger
 * /api/organizations:
 *   get:
 *     summary: Get all organizations
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **SUPER_ADMIN only** - List all organizations in the system.
 *     responses:
 *       200:
 *         description: List of all organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *       403:
 *         description: SUPER_ADMIN role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
  router.get('/organizations', authMiddleware.authenticate, authMiddleware.authorize('SUPER_ADMIN'), organizationController.getAll)

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **SUPER_ADMIN only** - Retrieve details of a specific organization.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Organization UUID
 *     responses:
 *       200:
 *         description: Organization details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       403:
 *         description: SUPER_ADMIN role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
  router.get('/organizations/:id', authMiddleware.authenticate, authMiddleware.authorize('SUPER_ADMIN'), organizationController.getById)

/**
 * @swagger
 * /api/organizations/{id}:
 *   put:
 *     summary: Update organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **SUPER_ADMIN only** - Update an existing organization.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Organization UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: ABC Agricultural Ltd Updated
 *               slug:
 *                 type: string
 *                 example: abc-agri-updated
 *               email:
 *                 type: string
 *                 example: info@abcagri.com
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       403:
 *         description: SUPER_ADMIN role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
  router.put('/organizations/:id', authMiddleware.authenticate, authMiddleware.authorize('SUPER_ADMIN'), organizationController.updateValidation, organizationController.update)

  // Docs for both routes below live in organization.swagger.ts, alongside
  // every other /organizations/{id}/... sub-resource in this module.
  router.patch(
    '/organizations/:id/settings',
    authMiddleware.authenticate,
    organizationController.updateSettingsValidation,
    organizationController.updateSettings
  )

  router.get(
    '/organizations/:id/settings',
    authMiddleware.authenticate,
    organizationController.getSettings
  )

  return router
}
