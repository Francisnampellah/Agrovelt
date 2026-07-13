# Review Package Task 5
BASE: 46cfa4b379b6059b28790f143b4c49fbeafef8b5
HEAD: 27ac185d0820a967b6ff6a4109c31d700feaf2e6

## Commits
27ac185 fix(auth): preserve STAFF/MANAGER on exchange and return shop scope

## Stat
 src/modules/auth/auth.service.exchange.test.ts | 14 ++++++
 src/modules/auth/auth.service.ts               | 63 ++++++++++++++++++--------
 src/modules/auth/collectorResponse.ts          |  8 +++-
 src/modules/auth/types.ts                      |  3 ++
 4 files changed, 69 insertions(+), 19 deletions(-)

## Diff
```diff
diff --git a/src/modules/auth/auth.service.exchange.test.ts b/src/modules/auth/auth.service.exchange.test.ts
new file mode 100644
index 0000000..825dd92
--- /dev/null
+++ b/src/modules/auth/auth.service.exchange.test.ts
@@ -0,0 +1,14 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import * as authService from './auth.service'
+
+const shouldPreserveLocalRole = (authService as unknown as {
+  shouldPreserveLocalRole?: (role: string) => boolean
+}).shouldPreserveLocalRole
+
+test('preserves STAFF and MANAGER local roles during Firebase exchange', () => {
+  assert.equal(typeof shouldPreserveLocalRole, 'function')
+  assert.equal(shouldPreserveLocalRole?.('STAFF'), true)
+  assert.equal(shouldPreserveLocalRole?.('MANAGER'), true)
+  assert.equal(shouldPreserveLocalRole?.('OWNER'), false)
+})
diff --git a/src/modules/auth/auth.service.ts b/src/modules/auth/auth.service.ts
index ad088f1..7b641c9 100644
--- a/src/modules/auth/auth.service.ts
+++ b/src/modules/auth/auth.service.ts
@@ -2,20 +2,21 @@ import bcrypt from 'bcrypt'
 import jwt from 'jsonwebtoken'
 import crypto from 'crypto'
 import { PrismaClient, Role } from '@prisma/client'
 import { firebaseAuth, firebaseFirestore } from '../../config/firebase'
 import { LoginRequest, RegisterRequest, AuthResponse, JWTPayload, ExchangeRequest, TokenResponse } from './types'
 import {
   mapFirebaseGlobalRoleToAgrovetRole,
   resolveExchangeGlobalRole,
   validateFirestoreAgrovetRole
 } from './firebaseRoleMapping'
+import { resolveShopScope } from './shopScope'
 
 const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
 const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'
 const JWT_EXPIRES_IN_SECONDS = parseExpiresInSeconds(JWT_EXPIRES_IN)
 const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7 // Long-lived refresh token
 
 function parseExpiresInSeconds(value: string): number {
   const match = value.trim().match(/^(\d+)([smhd])?$/i)
   if (!match) return 15 * 60
 
@@ -28,20 +29,24 @@ function parseExpiresInSeconds(value: string): number {
     case 'h':
       return amount * 60 * 60
     case 'm':
       return amount * 60
     case 's':
     default:
       return amount
   }
 }
 
+export function shouldPreserveLocalRole(localRole: string): boolean {
+  return localRole === 'STAFF' || localRole === 'MANAGER'
+}
+
 export class AuthService {
   constructor(private prisma: PrismaClient) {}
 
   private generateRefreshToken(): string {
     return crypto.randomBytes(40).toString('hex')
   }
 
   async register(data: RegisterRequest): Promise<AuthResponse> {
     const { name, email, password, role = Role.STAFF, organizationId } = data
 
@@ -279,43 +284,49 @@ export class AuthService {
             firebaseUid: uid,
             role: localRole
           },
           include: {
             shopsOwned: { select: { id: true } },
             staffIn: { select: { shopId: true } }
           }
         })
       } else if (user.firebaseUid && user.firebaseUid !== uid) {
         throw new Error('Email is already linked to a different Firebase account')
-      } else if (!user.firebaseUid || user.role !== localRole) {
-        user = await this.prisma.user.update({
-          where: { id: user.id },
-          data: {
-            firebaseUid: user.firebaseUid || uid,
-            role: localRole
-          },
-          include: {
-            shopsOwned: { select: { id: true } },
-            staffIn: { select: { shopId: true } }
-          }
-        })
+      } else {
+        const updateData: { firebaseUid?: string; role?: Role } = {}
+        if (!user.firebaseUid) updateData.firebaseUid = uid
+        if (!shouldPreserveLocalRole(user.role) && user.role !== localRole) {
+          updateData.role = localRole
+        }
+        if (Object.keys(updateData).length > 0) {
+          user = await this.prisma.user.update({
+            where: { id: user.id },
+            data: updateData,
+            include: {
+              shopsOwned: { select: { id: true } },
+              staffIn: { select: { shopId: true } }
+            }
+          })
+        }
       }
 
       if (!user.isActive) {
         throw new Error('User account is deactivated')
       }
 
       // 5. Resolve shop scope
-      const shopScope = [
-        ...user.shopsOwned.map(s => s.id),
-        ...user.staffIn.map(s => s.shopId)
-      ]
+      const shopScope = await resolveShopScope(this.prisma, {
+        userId: user.id,
+        role: user.role,
+        organizationId: user.organizationId,
+        managerAccess: user.managerAccess
+      })
 
       // 6. Issue backend tokens
       const accessToken = this.generateToken({
         userId: user.id,
         email: user.email,
         role: user.role,
         ...(user.organizationId ? { organizationId: user.organizationId } : {})
       })
 
       const refreshToken = this.generateRefreshToken()
@@ -333,38 +344,42 @@ export class AuthService {
         accessToken,
         refreshToken,
         expiresIn: JWT_EXPIRES_IN_SECONDS,
         user: {
           id: user.id,
           name: user.name,
           email: user.email,
           role: user.role,
           organizationId: user.organizationId,
           isActive: user.isActive,
-          shopScope
+          managerAccess: user.managerAccess,
+          allShops: shopScope.allShops,
+          shopScope: shopScope.shopIds,
+          shops: shopScope.shops
         }
       }
     } catch (error: any) {
       throw new Error(`Exchange failed: ${error.message}`)
     }
   }
 
   async getProfile(userId: string) {
     const user = await this.prisma.user.findUnique({
       where: { id: userId },
       select: {
         id: true,
         firebaseUid: true,
         name: true,
         email: true,
         role: true,
         organizationId: true,
+        managerAccess: true,
         isActive: true,
         createdAt: true,
         shopsOwned: {
           select: {
             id: true,
             name: true,
             location: true
           }
         },
         staffIn: {
@@ -379,21 +394,33 @@ export class AuthService {
             role: true
           }
         }
       }
     })
 
     if (!user) {
       throw new Error('User not found')
     }
 
-    return user
+    const shopScope = await resolveShopScope(this.prisma, {
+      userId: user.id,
+      role: user.role,
+      organizationId: user.organizationId,
+      managerAccess: user.managerAccess
+    })
+
+    return {
+      ...user,
+      allShops: shopScope.allShops,
+      shopScope: shopScope.shopIds,
+      shops: shopScope.shops
+    }
   }
 
   async updateProfile(userId: string, data: { name?: string; email?: string }) {
     const user = await this.prisma.user.update({
       where: { id: userId },
       data,
       select: {
         id: true,
         name: true,
         email: true,
diff --git a/src/modules/auth/collectorResponse.ts b/src/modules/auth/collectorResponse.ts
index 9a4df11..cd2fcfc 100644
--- a/src/modules/auth/collectorResponse.ts
+++ b/src/modules/auth/collectorResponse.ts
@@ -1,20 +1,23 @@
 import { TokenResponse } from './types'
 
 export interface CollectorAuthUser {
   id: string
   name: string
   email: string
   role: string
   organizationId?: string | null
   isActive: boolean
+  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
+  allShops?: boolean
   shopScope?: string[]
+  shops?: { shopId: string; name: string }[]
 }
 
 /** Mobile app accepts token | accessToken at top-level or under data */
 export function formatCollectorAuthResponse(
   message: string,
   tokens: {
     accessToken: string
     token?: string
     refreshToken: string
     expiresIn: number
@@ -37,13 +40,16 @@ export function formatCollectorAuthResponse(
 
 export function collectorUserFromExchange(result: TokenResponse): CollectorAuthUser {
   const u = result.user
   return {
     id: u.id,
     name: u.name,
     email: u.email,
     role: u.role,
     organizationId: u.organizationId ?? null,
     isActive: u.isActive,
-    ...(u.shopScope ? { shopScope: u.shopScope } : {})
+    managerAccess: u.managerAccess ?? null,
+    ...(u.allShops !== undefined ? { allShops: u.allShops } : {}),
+    ...(u.shopScope ? { shopScope: u.shopScope } : {}),
+    ...(u.shops ? { shops: u.shops } : {})
   }
 }
diff --git a/src/modules/auth/types.ts b/src/modules/auth/types.ts
index f10165b..4b4502e 100644
--- a/src/modules/auth/types.ts
+++ b/src/modules/auth/types.ts
@@ -26,21 +26,24 @@ export interface TokenResponse {
   accessToken: string
   refreshToken: string
   expiresIn: number
   user: {
     id: string
     name: string
     email: string
     role: string
     organizationId?: string | null
     isActive: boolean
+    managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
+    allShops: boolean
     shopScope?: string[]
+    shops: { shopId: string; name: string }[]
   }
 }
 
 export interface AuthResponse {
   user: {
     id: string
     name: string
     email: string
     role: string
     organizationId?: string
```
