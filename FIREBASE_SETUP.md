# Firebase Authentication Setup Guide

## Overview
This system now supports Firebase authentication alongside the existing JWT system. Firebase users are automatically synced with the Prisma database on first login.

## Firebase Setup Steps

### 1. Create a Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Click "Add project" and follow the setup wizard
- Enable Authentication > Email/Password and Social Login (Google, GitHub, etc.)

### 2. Get Service Account Credentials

**Option A: Environment Variable (Recommended)**
- In Firebase Console, go to Project Settings → Service Accounts
- Click "Generate New Private Key"
- Copy the JSON content
- Set environment variable:
```bash
export FIREBASE_CREDENTIALS='{"type":"service_account",...}'
```

**Option B: Local File (Development Only)**
- Download JSON key from Firebase Console
- Save as `src/firebase-credentials.json`
- Add to `.gitignore`

### 3. Environment Setup
```bash
# .env file
DATABASE_URL=postgresql://user:password@localhost:5432/agrovelt
FIREBASE_CREDENTIALS='{"type":"service_account",...}'
PORT=3000
```

## API Endpoints

### Firebase Verification & User Sync
**POST** `/api/firebase/verify`
```json
{
  "token": "firebase_id_token"
}
```
- Verifies Firebase token
- Creates/syncs user in Prisma database
- Returns user data

### Get User Profile
**GET** `/api/firebase/profile`
- Headers: `Authorization: Bearer <firebase_token>`
- Returns user profile with Firebase and Prisma data

### Update User Profile
**PUT** `/api/firebase/profile`
- Headers: `Authorization: Bearer <firebase_token>`
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```
- Updates in both Firebase and Prisma

## Client-Side Integration (Frontend)

### Example: React
```typescript
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

const firebaseApp = initializeApp(firebaseConfig)
const auth = getAuth(firebaseApp)

async function loginAndSyncWithBackend(email: string, password: string) {
  // Step 1: Sign in with Firebase
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  const idToken = await userCredential.user.getIdToken()
  
  // Step 2: Verify and sync with backend
  const response = await fetch('http://localhost:3000/api/firebase/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: idToken })
  })
  
  const userData = await response.json()
  
  // Step 3: Store tokens
  localStorage.setItem('firebaseToken', idToken)
  localStorage.setItem('userData', JSON.stringify(userData.user))
  
  return userData
}

// Use for all subsequent API calls
async function callProtectedEndpoint(url: string) {
  const token = localStorage.getItem('firebaseToken')
  
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
}
```

## Database Schema Changes

The `User` model now includes:
```prisma
model User {
  id            String   @id @default(uuid())
  firebaseUid   String?  @unique    // Firebase unique identifier
  name          String
  email         String   @unique
  passwordHash  String?  // Only for JWT users
  role          Role
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  
  // ... relations
}
```

- **firebaseUid**: Stores the Firebase user ID (optional, only for Firebase users)
- **passwordHash**: Only used for traditional JWT authentication (optional)

## Authentication Flow

1. **User Signs Up/Logs In with Firebase** (via client)
2. **Frontend gets Firebase ID token**
3. **Frontend sends token to `/api/firebase/verify`**
4. **Backend:**
   - Verifies token with Firebase Admin SDK
   - Checks if user exists in Prisma
   - If new: creates user with STAFF role
   - If exists: updates lastLogin or syncs data
5. **Backend returns user data**
6. **Frontend stores token for subsequent requests**

## Authorization

The system uses role-based access control:
- **ADMIN**: Full system access
- **OWNER**: Can manage their shops
- **STAFF**: Can access assigned shops only

Firebase users default to **STAFF** role on first login. Update in database to change roles.

## Migration from JWT to Firebase

If transitioning from existing JWT system:

1. Existing users keep their JWT authentication
2. New users sign up with Firebase
3. Existing users can link Firebase via profile settings (requires additional implementation)
4. Eventually migrate all to Firebase

## Troubleshooting

### "Invalid token" error
- Check token hasn't expired
- Verify token is from correct Firebase project
- Ensure `FIREBASE_CREDENTIALS` is set correctly

### "User must use Firebase authentication"
- User was created with JWT, try Firebase instead
- Or use their existing email/password

### "Token verification failed"
- Firebase service account key is invalid
- Firebase project is disabled
- Network connectivity issue

## Security Best Practices

1. ✅ Store Firebase credentials in environment variables
2. ✅ Never commit `firebase-credentials.json` to git
3. ✅ Use HTTPS in production
4. ✅ Implement token refresh strategy on frontend
5. ✅ Validate all tokens on backend before processing
6. ✅ Set up Firebase security rules
7. ✅ Monitor Firebase console for suspicious activity

## Next Steps

1. Set up Firebase project
2. Configure environment variables
3. Update frontend to use Firebase SDK
4. Test authentication flow
5. Deploy to production

For more info: [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
