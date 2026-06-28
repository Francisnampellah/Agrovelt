import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createOrganizationModule, OrganizationModuleDeps } from '../modules/organizations'

const router = Router()

export function createOrganizationRoutes(
  prisma: PrismaClient,
  deps?: OrganizationModuleDeps
) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { organizationController } = createOrganizationModule(prisma, deps)

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

  return router
}
