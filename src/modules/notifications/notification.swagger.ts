/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications for an organization
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: organizationId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *       - name: unreadOnly
 *         in: query
 *         schema: { type: boolean }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [SALE, PURCHASE, EXPENSE, SALE_REFUND, SYSTEM] }
 *     responses:
 *       200:
 *         description: Notification list
 *
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: organizationId
 *         in: query
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unread count
 *
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId]
 *             properties:
 *               organizationId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: All marked read
 *
 * /api/notifications/{notificationId}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification detail
 *       404:
 *         description: Not found
 *
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Marked read
 */
