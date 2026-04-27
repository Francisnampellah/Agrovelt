# Authentication & Authorization Guide

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Authentication Methods](#authentication-methods)
3. [Authorization & Role-Based Access Control](#authorization--role-based-access-control)
4. [JWT Authentication Flow](#jwt-authentication-flow)
5. [Firebase Authentication Flow](#firebase-authentication-flow)
6. [Middleware & Security](#middleware--security)
7. [API Endpoints](#api-endpoints)
8. [Implementation Details](#implementation-details)
9. [Security Best Practices](#security-best-practices)

---

## Core Concepts

### Authentication vs Authorization

**Authentication** verifies **WHO** you are:
- Confirms user identity through credentials (password, Firebase token, etc.)
- Answers: "Are you who you claim to be?"
- Examples: login, registration, token verification

**Authorization** verifies **WHAT** you can do:
- Grants access to specific resources based on roles/permissions
- Answers: "Are you allowed to access this resource?"
- Examples: Admin-only endpoints, role-based restrictions

---

## Authentication Methods

The system supports **two authentication methods**:

| Feature | JWT Auth | Firebase Auth |
|---------|----------|---------------|
| Credentials | Email + Password | Firebase Account |
| Password Hash | Stored locally | Managed by Firebase |
| Social Login | Not supported | Supported (Google, GitHub, etc.) |
| Token Type | Custom JWT | Firebase ID Token |
| User Storage | Prisma database | Prisma + Firebase |
| Session Management | Manual (refresh tokens) | Firebase managed |
| Multi-factor Auth | Not built-in | Firebase supports |

---

## Authentication Methods in Detail

### JWT Authentication
Users register/login with email and password. The system generates JWT tokens for session management.

```
User Credentials → Hash Password → Store in DB → Generate JWT Token
```

### Firebase Authentication
Users authenticate with Firebase (email, password, or social login). Backend verifies Firebase tokens and syncs user to local database.

```
Firebase Credentials → Firebase Verifies → Backend Verifies Token → Sync User to DB
```

---

## Authorization & Role-Based Access Control

### User Roles

The system defines three roles in the `Role` enum:

```prisma
enum Role {
  ADMIN      # Full system access, can manage all shops and users
  OWNER      # Can manage their own shops and inventory
  STAFF      # Can only access assigned shops
}
```

### Role Permissions Matrix

| Endpoint | ADMIN | OWNER | STAFF |
|----------|-------|-------|-------|
| `GET /api/users` | ✅ | ❌ | ❌ |
| `POST /api/users` | ✅ | ❌ | ❌ |
| `PUT /api/admin/users/:userId/deactivate` | ✅ | ❌ | ❌ |
| `GET /api/auth/profile` | ✅ | ✅ | ✅ |
| `PUT /api/auth/profile` | ✅ | ✅ | ✅ |
| `GET /api/shops` | ✅ | ✅ | ✅ |
| `POST /api/shops` | ✅ | ✅ | ❌ |
| `GET /api/products` | ✅ | ✅ | ✅ |
| `POST /api/products` | ✅ | ✅ | ❌ |

### Role Assignment

**JWT Users:**
- Specified during registration: `role: 'ADMIN' | 'OWNER' | 'STAFF'`
- Can be changed by admins in database

**Firebase Users:**
- Default role on first login: `STAFF`
- Must be changed by admin in database

---

## JWT Authentication Flow

### Registration Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. User submits registration form                   │
│    POST /api/auth/register                          │
│    {                                                │
│      "name": "John Doe",                           │
│      "email": "john@example.com",                  │
│      "password": "SecurePass@123",                 │
│      "role": "STAFF"                               │
│    }                                               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 2. Backend Validation                               │
│    - Check email format (valid email)              │
│    - Check password strength (8+ chars, mixed)     │
│    - Verify email not already registered           │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 3. Password Hashing                                 │
│    - bcrypt with 12 salt rounds                    │
│    - Generate: hash($password, 12)                 │
│    - Cannot be reversed                            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 4. Database Storage                                 │
│    - Create user record in Prisma                  │
│    - Store: name, email, passwordHash, role        │
│    - Generate: userId (UUID)                       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 5. Token Generation                                 │
│    - Access Token: JWT valid 1 hour               │
│    - Refresh Token: 7-day token for new access    │
│    - Both stored and returned                      │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 6. Return to Client                                 │
│    {                                                │
│      "accessToken": "eyJhbGc...",                  │
│      "refreshToken": "xyz123...",                  │
│      "user": {                                      │
│        "id": "uuid-123",                           │
│        "email": "john@example.com",                │
│        "name": "John Doe",                         │
│        "role": "STAFF"                             │
│      }                                              │
│    }                                                │
└─────────────────────────────────────────────────────┘
```

### Login Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. User submits login credentials                   │
│    POST /api/auth/login                            │
│    {                                                │
│      "email": "john@example.com",                  │
│      "password": "SecurePass@123"                  │
│    }                                               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 2. Input Validation                                 │
│    - Email format check                            │
│    - Password not empty                            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 3. Find User in Database                            │
│    - Query by email                                │
│    - Check if user exists                          │
│    - Check if user is active                       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 4. Password Verification                            │
│    - bcrypt.compare(password, passwordHash)        │
│    - If mismatch → "Invalid credentials"           │
│    - If match → Continue                           │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 5. Generate New Tokens                              │
│    - Access Token (1 hour expiration)              │
│    - Refresh Token (7 days expiration)             │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 6. Return Success Response                          │
│    {                                                │
│      "accessToken": "eyJhbGc...",                  │
│      "refreshToken": "xyz123...",                  │
│      "user": {...}                                  │
│    }                                                │
└─────────────────────────────────────────────────────┘
```

### JWT Token Structure

**Access Token (Payload Example):**
```json
{
  "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "john@example.com",
  "role": "STAFF",
  "iat": 1704067200,
  "exp": 1704070800,
  "iss": "agrovelt-pos"
}
```

**Refresh Token (Payload Example):**
```json
{
  "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "type": "refresh",
  "iat": 1704067200,
  "exp": 1704672000,
  "iss": "agrovelt-pos"
}
```

---

## Firebase Authentication Flow

### Registration/Sign-Up Flow

```
┌──────────────────────────────────────────────────────┐
│ 1. User Sign-Up with Firebase (Frontend)            │
│    - Email + Password OR Social Login               │
│    - Firebase handles password security             │
│    - Firebase generates unique UID                  │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│ 2. Firebase Issues ID Token (Frontend)              │
│    - Valid for 1 hour                               │
│    - Contains: uid, email, name, etc.               │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│ 3. Frontend Sends Token to Backend                  │
│    POST /api/firebase/verify                        │
│    {                                                │
│      "token": "eyJhbGciOiJSUzI1NiIsInR5c..."       │
│    }                                                │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│ 4. Backend Verifies Token                           │
│    - firebaseAuth.verifyIdToken(token)              │
│    - Validates signature & expiration               │
│    - Extracts: uid, email, name from token          │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│ 5. Check if User Exists in Prisma                   │
│    - Query: User.findUnique({firebaseUid: uid})     │
│    - If exists → Update lastLogin                   │
│    - If not exists → Create new user                │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│ 6. Return User Data                                 │
│    {                                                │
│      "userId": "prisma-id",                         │
│      "firebaseUid": "firebase-uid",                 │
│      "email": "john@example.com",                   │
│      "name": "John Doe",                            │
│      "role": "STAFF"                                │
│    }                                                │
└──────────────────────────────────────────────────────┘
```

### Firebase Token Verification

**Verification Process:**
```
ID Token (JWT) → Base64 Decode → Extract Header/Payload
                              ↓
                    Verify Signature
                    (Firebase Public Key)
                              ↓
                    Check Expiration
                    (iat + 3600 seconds)
                              ↓
                    Verify Project ID
                              ↓
                    Extract User Claims
                    (uid, email, name, etc.)
```

---

## Middleware & Security

### Authentication Middleware Flow

```
Request comes in
      ↓
Extract Token from Header
      Authorization: Bearer <token>
      ↓
┌─────────────────────────────┐
│ Is token present?           │
├─────────────────────────────┤
│ No  → 401 Unauthorized      │
│ Yes → Continue              │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│ Verify Token Signature      │
├─────────────────────────────┤
│ Invalid → 401 Unauthorized  │
│ Valid   → Continue          │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│ Check Token Expiration      │
├─────────────────────────────┤
│ Expired → 401 Unauthorized  │
│ Valid   → Continue          │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│ Check Token Blacklist       │
├─────────────────────────────┤
│ Blacklisted → 401           │
│ Active      → Continue      │
└─────────────────────────────┘
      ↓
Attach user to request
req.user = {userId, role, email}
      ↓
Call next middleware
```

### Authorization Middleware Flow

```
Request with authenticated user
      ↓
┌──────────────────────────────────┐
│ Get Required Role(s)             │
│ Example: authorize(['ADMIN'])    │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Fetch User from Database         │
│ Query: User.findUnique(userId)   │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Compare User Role                │
├──────────────────────────────────┤
│ Not in required roles → 403      │
│ In required roles    → Continue  │
└──────────────────────────────────┘
      ↓
Route handler executes
```

### Global Authorization Checker

```
Every Request
      ↓
Check if endpoint requires auth
      ↓
┌────────────────────────────────┐
│ Is endpoint public?            │
├────────────────────────────────┤
│ Yes (register, login) → Skip   │
│ No  → Check authentication     │
└────────────────────────────────┘
      ↓
Validate token (if required)
      ↓
Continue to route
```

---

## API Endpoints

### Public Endpoints (No Authentication)

#### Register User (JWT)
```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass@123",
  "role": "STAFF"  // optional
}

Response 201:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "xyz123...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "STAFF"
  }
}
```

#### Login User (JWT)
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass@123"
}

Response 200:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "xyz123...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "role": "STAFF"
  }
}
```

#### Verify Firebase Token
```
POST /api/firebase/verify
Content-Type: application/json

{
  "token": "firebase_id_token"
}

Response 200:
{
  "userId": "prisma-id",
  "firebaseUid": "firebase-uid",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "STAFF"
}
```

### Protected Endpoints (Require Authentication)

#### Get User Profile
```
GET /api/auth/profile
Authorization: Bearer <access_token>

Response 200:
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "STAFF",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Update Profile
```
PUT /api/auth/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
}

Response 200:
{
  "message": "Profile updated successfully",
  "user": {...}
}
```

#### Change Password (JWT only)
```
PUT /api/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "oldPassword": "CurrentPass@123",
  "newPassword": "NewPass@456"
}

Response 200:
{
  "message": "Password changed successfully"
}
```

#### Refresh Token (JWT only)
```
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "refresh_token_value"
}

Response 200:
{
  "accessToken": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "refresh_token_value"  // optional
}

Response 200:
{
  "message": "Logged out successfully"
}
```

### Admin-Only Endpoints

#### Get All Users
```
GET /api/admin/users
Authorization: Bearer <admin_token>

Response 200:
[
  {
    "id": "uuid",
    "email": "user1@example.com",
    "name": "User 1",
    "role": "STAFF",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  ...
]
```

#### Deactivate User
```
PUT /api/admin/users/:userId/deactivate
Authorization: Bearer <admin_token>

Response 200:
{
  "message": "User deactivated successfully",
  "user": {...}
}
```

---

## Implementation Details

### File Structure

```
src/
├── modules/
│   ├── auth/                          # JWT Authentication
│   │   ├── auth.service.ts           # Business logic
│   │   ├── auth.controller.ts        # Route handlers
│   │   ├── auth.middleware.ts        # Token verification
│   │   ├── types.ts                  # TypeScript interfaces
│   │   └── index.ts
│   └── firebase/                      # Firebase Integration
│       ├── firebase.service.ts       # Firebase sync logic
│       ├── firebase.controller.ts    # Route handlers
│       ├── firebase.middleware.ts    # Token verification
│       └── index.ts
├── config/
│   ├── database.ts                    # Prisma setup
│   ├── firebase.ts                    # Firebase Admin SDK
│   ├── middleware.ts                  # Rate limiting
│   └── swagger.ts                     # API documentation
└── routes/
    ├── auth.ts                        # JWT auth routes
    ├── firebase.ts                    # Firebase routes
    ├── admin.ts                       # Admin routes
    └── ...
```

### Database Models

```prisma
model User {
  id            String   @id @default(uuid())
  firebaseUid   String?  @unique        # Firebase users
  email         String   @unique
  name          String
  passwordHash  String?  # JWT users only
  role          Role     @default(STAFF)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())

  refreshTokens RefreshToken[]
  auditLogs     AuditLog[]
}

model RefreshToken {
  id          String   @id @default(uuid())
  token       String   @unique
  userId      String
  expiresAt   DateTime
  isRevoked   Boolean  @default(false)
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
}

model TokenBlocklist {
  id          String   @id @default(uuid())
  token       String   @unique
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}
```

### Security Measures

**1. Password Hashing**
```typescript
// Bcrypt with 12 salt rounds
const passwordHash = await bcrypt.hash(password, 12)
const isValid = await bcrypt.compare(password, passwordHash)
```

**2. Token Encryption**
```typescript
// JWT signed with HS256 algorithm
const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '1h',
  algorithm: 'HS256'
})
```

**3. Token Blacklist**
```typescript
// On logout, add token to blacklist
await prisma.tokenBlocklist.create({
  data: {
    token: accessToken,
    expiresAt: new Date(Date.now() + 3600000) // 1 hour
  }
})
```

**4. Rate Limiting**
```typescript
// 20 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts'
})
```

**5. Input Validation**
```typescript
// Express-validator with strong rules
body('password')
  .isLength({ min: 8 })
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  .withMessage('Password must contain uppercase, lowercase, number, and special char')
```

---

## Security Best Practices

### 1. Token Management

❌ **Don't:**
```javascript
// Storing tokens in localStorage (vulnerable to XSS)
localStorage.setItem('token', token)

// Sending token in URL query params
fetch(`/api/profile?token=${token}`)

// Logging tokens to console
console.log('Token:', token)
```

✅ **Do:**
```javascript
// Store tokens in httpOnly cookies (server-set, JS-inaccessible)
// OR use in-memory storage with short expiration

// Send in Authorization header
fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
})

// Log token hash for debugging only
console.log('Token (hash):', crypto.createHash('sha256').update(token).digest('hex'))
```

### 2. Password Security

❌ **Don't:**
```typescript
// Storing plain text passwords
user.password = password

// Using weak hashing
const hash = MD5(password)

// Comparing plain strings
if (password === user.password)
```

✅ **Do:**
```typescript
// Hash with bcrypt + salt rounds
const hash = await bcrypt.hash(password, 12)

// Compare with bcrypt
const valid = await bcrypt.compare(password, hash)

// Enforce strong password policy
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
```

### 3. Firebase Security

❌ **Don't:**
```typescript
// Committing credentials
process.env.FIREBASE_CREDENTIALS = '{"type":"service_account"...}'

// Using same key for multiple environments
adminApp.initializeApp({ credential: serviceAccountKey })

// Trusting tokens without verification
const uid = payload.uid  // Could be spoofed
```

✅ **Do:**
```typescript
// Store in environment variable
const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS)

// Always verify tokens server-side
const decodedToken = await admin.auth().verifyIdToken(token)
const uid = decodedToken.uid  // Verified

// Different service accounts per environment
// dev-firebase-key.json, prod-firebase-key.json
```

### 4. Authorization Checks

❌ **Don't:**
```typescript
// Trusting client-provided role
const role = req.body.role  // User could send "ADMIN"

// Skipping authorization checks
// Just because token is valid doesn't mean user can access resource
```

✅ **Do:**
```typescript
// Always fetch role from database
const user = await prisma.user.findUnique({ where: { id: userId } })
const role = user.role  // From DB, not client

// Implement proper authorization
app.get('/api/admin/users', 
  authenticate,
  authorize(['ADMIN']),
  handler
)
```

### 5. Rate Limiting

```typescript
// Applied to sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                     // 20 requests
  skipSuccessfulRequests: false,
  skipFailedRequests: false
})

app.post('/api/auth/login', authLimiter, loginHandler)
app.post('/api/auth/register', authLimiter, registerHandler)
```

---

## Troubleshooting

### Common Issues

**"Invalid credentials" on login**
- Check email exists in database
- Verify password is correct (case-sensitive)
- Ensure user account is active (isActive: true)

**"Invalid or expired token"**
- Token may have expired (1 hour for JWT)
- Token signature may be invalid
- Token may be blacklisted (after logout)

**"Unauthorized (401)"**
- Missing Authorization header
- Token not in correct format: `Bearer <token>`
- Token is invalid or expired

**"Forbidden (403)"**
- Token is valid but user lacks permission
- User role doesn't match required role
- User may be inactive

**Firebase token verification fails**
- Service account key is invalid
- Firebase project disabled
- Token is from different Firebase project
- Network connectivity issue

---

## Comparison: JWT vs Firebase

### JWT Authentication
**Pros:**
- Full control over token generation
- No external dependency
- Lightweight

**Cons:**
- Manual token management
- Must handle password storage
- No built-in multi-factor auth

### Firebase Authentication
**Pros:**
- Social login support
- Built-in security features
- Multi-factor authentication
- Professional managed service

**Cons:**
- External dependency
- Firebase costs
- More complex setup

---

## Glossary

- **Access Token**: Short-lived token (1 hour) for API requests
- **Refresh Token**: Long-lived token (7 days) to get new access token
- **JWT**: JSON Web Token, digitally signed token containing claims
- **Bcrypt**: Password hashing algorithm with salt rounds
- **Payload**: Data encoded in JWT (user ID, role, etc.)
- **Middleware**: Function that processes request before reaching handler
- **Role**: User permission level (ADMIN, OWNER, STAFF)
- **Blacklist**: Database of revoked tokens
- **Salt Rounds**: Number of iterations in bcrypt hashing
- **Authorization Header**: Header containing authentication token

---

## References

- [JWT.io - JWT Information](https://jwt.io)
- [OWASP - Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Bcrypt Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
