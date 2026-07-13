# Review Package Task 9 (re-review)
BASE: 8320e0c4214989a03717b129289635e9199877de
HEAD: 13b2d87c5034f9bee68dac7101f4583abc664fe2

## Commits
13b2d87 fix(auth): block STAFF/MANAGER on public register
4f0eaac docs(auth): document MANAGER role and tighten public register

## Stat
 scripts/audit-multi-shop-staff.ts                 | 44 +++++++++++++++++++++++
 src/config/swagger.ts                             |  2 +-
 src/modules/auth/auth.controller.register.test.ts | 43 ++++++++++++++++++++++
 src/modules/auth/auth.controller.ts               |  3 +-
 src/modules/auth/auth.service.ts                  |  6 +++-
 src/modules/auth/auth.swagger.ts                  |  5 +--
 src/routes/auth.ts                                |  7 ++--
 src/routes/users.ts                               |  5 +--
 8 files changed, 105 insertions(+), 10 deletions(-)

## Diff
```diff
diff --git a/scripts/audit-multi-shop-staff.ts b/scripts/audit-multi-shop-staff.ts
new file mode 100644
index 0000000..7296040
--- /dev/null
+++ b/scripts/audit-multi-shop-staff.ts
@@ -0,0 +1,44 @@
+import 'dotenv/config'
+import { PrismaClient } from '@prisma/client'
+
+async function main() {
+  const prisma = new PrismaClient()
+
+  const staffUsers = await prisma.user.findMany({
+    where: { role: 'STAFF' },
+    select: {
+      id: true,
+      name: true,
+      email: true,
+      organizationId: true,
+      staffIn: {
+        select: {
+          shopId: true,
+          shop: { select: { name: true } }
+        }
+      }
+    }
+  })
+
+  const multiShopStaff = staffUsers.filter(user => user.staffIn.length > 1)
+
+  console.log(JSON.stringify({
+    totalStaff: staffUsers.length,
+    multiShopCount: multiShopStaff.length,
+    multiShopStaff: multiShopStaff.map(user => ({
+      id: user.id,
+      email: user.email,
+      name: user.name,
+      organizationId: user.organizationId,
+      shopCount: user.staffIn.length,
+      shops: user.staffIn.map(row => ({ shopId: row.shopId, name: row.shop.name }))
+    }))
+  }, null, 2))
+
+  await prisma.$disconnect()
+}
+
+main().catch(error => {
+  console.error(error)
+  process.exit(1)
+})
diff --git a/src/config/swagger.ts b/src/config/swagger.ts
index 0a96241..da8d7cb 100644
--- a/src/config/swagger.ts
+++ b/src/config/swagger.ts
@@ -57,21 +57,21 @@ export function getSwaggerConfig(port: number | string) {
                 description: 'Error message'
               }
             }
           },
           User: {
             type: 'object',
             properties: {
               id: { type: 'string', format: 'uuid' },
               name: { type: 'string' },
               email: { type: 'string', format: 'email' },
-              role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'STAFF'] },
+              role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF'] },
               organizationId: { type: 'string', format: 'uuid', nullable: true, description: 'Null for SUPER_ADMIN users' },
               isActive: { type: 'boolean' },
               createdAt: { type: 'string', format: 'date-time' }
             }
           },
           Organization: {
             type: 'object',
             properties: {
               id: { type: 'string', format: 'uuid' },
               name: { type: 'string' },
diff --git a/src/modules/auth/auth.controller.register.test.ts b/src/modules/auth/auth.controller.register.test.ts
new file mode 100644
index 0000000..b18d652
--- /dev/null
+++ b/src/modules/auth/auth.controller.register.test.ts
@@ -0,0 +1,43 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { validationResult } from 'express-validator'
+import { AuthController } from './auth.controller'
+import { AuthService } from './auth.service'
+
+const controller = new AuthController({} as AuthService)
+
+async function runRegisterValidation(body: Record<string, unknown>) {
+  const req = { body } as Parameters<typeof validationResult>[0]
+  for (const rule of controller.registerValidation) {
+    await rule.run(req)
+  }
+  return validationResult(req)
+}
+
+const baseBody = {
+  name: 'Test User',
+  email: 'test@example.com',
+  password: 'Password1',
+  organizationId: '123e4567-e89b-12d3-a456-426614174000'
+}
+
+test('registerValidation rejects STAFF role', async () => {
+  const result = await runRegisterValidation({ ...baseBody, role: 'STAFF' })
+  assert.ok(!result.isEmpty())
+  const firstError = result.array()[0]
+  assert.ok(firstError)
+  assert.equal(firstError.msg, 'Invalid role')
+})
+
+test('registerValidation rejects MANAGER role', async () => {
+  const result = await runRegisterValidation({ ...baseBody, role: 'MANAGER' })
+  assert.ok(!result.isEmpty())
+  const firstError = result.array()[0]
+  assert.ok(firstError)
+  assert.equal(firstError.msg, 'Invalid role')
+})
+
+test('registerValidation accepts OWNER role', async () => {
+  const result = await runRegisterValidation({ ...baseBody, role: 'OWNER' })
+  assert.ok(result.isEmpty())
+})
diff --git a/src/modules/auth/auth.controller.ts b/src/modules/auth/auth.controller.ts
index 9c03b75..1a212cd 100644
--- a/src/modules/auth/auth.controller.ts
+++ b/src/modules/auth/auth.controller.ts
@@ -10,21 +10,22 @@ export class AuthController {
   // Validation rules
   registerValidation = [
     body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
     body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
     body('organizationId').custom((value, { req }) => {
       if (req.body.role !== 'SUPER_ADMIN' && !value) {
         throw new Error('Organization ID is required for non-SUPER_ADMIN roles')
       }
       return true
     }).optional({ nullable: true }).isUUID().withMessage('Valid organization ID required if provided'),
-    body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN', 'OWNER', 'STAFF']).withMessage('Invalid role')
+    body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN', 'OWNER']).withMessage('Invalid role'),
+    body('shopId').optional({ nullable: true }).isUUID().withMessage('Valid shop ID required if provided')
   ]
 
   loginValidation = [
     body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
     body('password').notEmpty().withMessage('Password required')
   ]
 
   updateProfileValidation = [
     body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
     body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required')
diff --git a/src/modules/auth/auth.service.ts b/src/modules/auth/auth.service.ts
index 7b641c9..1f57589 100644
--- a/src/modules/auth/auth.service.ts
+++ b/src/modules/auth/auth.service.ts
@@ -41,21 +41,25 @@ export function shouldPreserveLocalRole(localRole: string): boolean {
 }
 
 export class AuthService {
   constructor(private prisma: PrismaClient) {}
 
   private generateRefreshToken(): string {
     return crypto.randomBytes(40).toString('hex')
   }
 
   async register(data: RegisterRequest): Promise<AuthResponse> {
-    const { name, email, password, role = Role.STAFF, organizationId } = data
+    const { name, email, password, role = Role.OWNER, organizationId } = data
+
+    if (role === Role.STAFF || role === Role.MANAGER) {
+      throw new Error('STAFF and MANAGER must be created via POST /api/organizations/{id}/users')
+    }
 
     // Check if user already exists
     const existingUser = await this.prisma.user.findUnique({
       where: { email }
     })
 
     if (existingUser) {
       throw new Error('User already exists with this email')
     }
 
diff --git a/src/modules/auth/auth.swagger.ts b/src/modules/auth/auth.swagger.ts
index d5e1d1f..f201359 100644
--- a/src/modules/auth/auth.swagger.ts
+++ b/src/modules/auth/auth.swagger.ts
@@ -19,22 +19,23 @@
  *                 type: string
  *                 minLength: 2
  *                 maxLength: 100
  *               email:
  *                 type: string
  *                 format: email
  *               password:
  *                 type: string
  *               role:
  *                 type: string
- *                 enum: [ADMIN, OWNER, STAFF]
- *                 default: STAFF
+ *                 enum: [SUPER_ADMIN, ADMIN, OWNER]
+ *                 default: OWNER
+ *                 description: STAFF and MANAGER must use POST /api/organizations/{id}/users
  *     responses:
  *       201:
  *         description: User registered successfully
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
diff --git a/src/routes/auth.ts b/src/routes/auth.ts
index e479044..9fead54 100644
--- a/src/routes/auth.ts
+++ b/src/routes/auth.ts
@@ -35,23 +35,24 @@ export function createAuthRoutes(prisma: PrismaClient) {
    *               email:
    *                 type: string
    *                 format: email
    *                 example: john@example.com
    *               password:
    *                 type: string
    *                 description: Same password used for Firebase login (no complexity rules)
    *                 example: Password1
    *               role:
    *                 type: string
-   *                 enum: [SUPER_ADMIN, ADMIN, OWNER, STAFF]
-   *                 default: STAFF
-   *                 example: ADMIN
+   *                 enum: [SUPER_ADMIN, ADMIN, OWNER]
+   *                 default: OWNER
+   *                 description: STAFF and MANAGER must use POST /api/organizations/{id}/users
+   *                 example: OWNER
    *               organizationId:
    *                 type: string
    *                 format: uuid
    *                 description: Required unless role is SUPER_ADMIN
    *                 example: 123e4567-e89b-12d3-a456-426614174000
    *     responses:
    *       201:
    *         description: User registered successfully
    *         content:
    *           application/json:
diff --git a/src/routes/users.ts b/src/routes/users.ts
index 304f775..b0c1c5e 100644
--- a/src/routes/users.ts
+++ b/src/routes/users.ts
@@ -68,22 +68,23 @@ router.get('/users', authMiddleware.authenticate, authMiddleware.authorize('ADMI
  *                 example: John Smith
  *               email:
  *                 type: string
  *                 format: email
  *                 example: john.smith@example.com
    *               password:
    *                 type: string
    *                 description: Same password used for Firebase login (no complexity rules)
  *               role:
  *                 type: string
- *                 enum: [SUPER_ADMIN, ADMIN, OWNER, STAFF]
- *                 default: STAFF
+ *                 enum: [SUPER_ADMIN, ADMIN, OWNER]
+ *                 default: OWNER
+ *                 description: STAFF and MANAGER must use POST /api/organizations/{id}/users
  *               organizationId:
  *                 type: string
  *                 format: uuid
  *                 description: Required unless role is SUPER_ADMIN
  *     responses:
  *       201:
  *         description: User created successfully
  *         content:
  *           application/json:
  *             schema:
```
