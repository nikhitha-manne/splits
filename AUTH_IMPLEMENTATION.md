# Firebase Authentication Implementation

## Overview
This document describes the Firebase-based authentication system implemented for the mobile expense-splitting app. The implementation follows the requirements exactly: email/password auth, 2-screen signup flow, persistent login, and proper role handling.

## Folder Structure

```
frontend/
├── src/
│   ├── auth/
│   │   └── AuthContext.tsx          # Global auth state with persistent login
│   ├── config/
│   │   └── firebase.ts              # Firebase initialization
│   ├── services/
│   │   └── authService.ts           # Firebase Auth & Firestore operations
│   ├── screens/
│   │   ├── LoginScreen.tsx          # Email + password login
│   │   ├── SignupScreen.tsx         # Main signup wrapper
│   │   ├── SignupScreen1.tsx        # Step 1: Email, Password, Confirm Password
│   │   ├── SignupScreen2.tsx        # Step 2: Name + Default Currency
│   │   └── HomeScreen.tsx           # Dashboard placeholder
│   ├── ProtectedRoute.tsx           # Route guard for authenticated routes
│   └── App.tsx                      # Main app router
├── firestore.rules                   # Firestore security rules
└── .env.example                      # Environment variables template
```

## Key Files

### 1. Firebase Configuration (`src/config/firebase.ts`)
- Initializes Firebase App, Auth, and Firestore
- Uses environment variables for configuration
- Exports `auth` and `db` instances

### 2. Auth Service (`src/services/authService.ts`)
**Functions:**
- `signup(data)` - Creates Firebase Auth user + Firestore user document
- `login(email, password)` - Signs in and fetches user from Firestore
- `logout()` - Signs out current user
- `getCurrentUser()` - Fetches current user from Firestore
- `validateEmail()` - Email format validation
- `validatePassword()` - Password strength validation (min 6 chars)
- `getAuthErrorMessage()` - Converts Firebase errors to user-friendly messages

**User Model:**
```typescript
interface User {
  uid: string;
  name: string;
  email: string;
  defaultCurrency: string;
  role: 'admin' | 'member';
  createdAt: Date;
}
```

### 3. Auth Context (`src/auth/AuthContext.tsx`)
- Uses Firebase's `onAuthStateChanged` for persistent login
- Automatically fetches user document from Firestore when auth state changes
- Provides `user`, `loading`, `login()`, `signup()`, `logout()` to entire app
- Maintains authentication state across page refreshes

### 4. Signup Flow

**Screen 1 (`SignupScreen1.tsx`):**
- Email input (with validation)
- Password input (min 6 characters)
- Confirm Password (must match)
- Validates all inputs before proceeding to screen 2

**Screen 2 (`SignupScreen2.tsx`):**
- Name input (required)
- Default Currency selector (dropdown with common currencies)
- Creates user account on submit
- Sets role = 'member' by default (admin cannot be assigned during signup)

**Main Signup (`SignupScreen.tsx`):**
- Manages state between screens 1 and 2
- Passes email/password from screen 1 to screen 2

### 5. Login Screen (`LoginScreen.tsx`)
- Email + Password fields
- Inline error messages
- Redirects to `/home` on success
- Link to signup screen

### 6. Protected Route (`ProtectedRoute.tsx`)
- Shows loading spinner while checking auth state
- Redirects to `/login` if not authenticated
- Allows access to nested routes if authenticated

### 7. Firestore Rules (`firestore.rules`)
**Users Collection Rules:**
- **Read**: User can only read their own document
- **Create**: 
  - Must be authenticated
  - `userId` must match authenticated user's `uid`
  - Must include required fields (uid, name, email, defaultCurrency, role, createdAt)
  - `role` must be 'member' (cannot create admin during signup)
- **Update**: 
  - User can update their own document
  - Cannot change `role` or `uid` fields (role assignment handled separately)
- **Delete**: Denied (users cannot delete their own documents)

## Authentication Flow

### Signup Flow
1. User enters email, password, confirm password (Screen 1)
2. Validates inputs (email format, password match, password length)
3. On valid inputs, proceeds to Screen 2
4. User enters name and selects default currency (Screen 2)
5. On submit:
   - Creates Firebase Auth user with `createUserWithEmailAndPassword()`
   - Updates Firebase Auth profile with display name
   - Creates Firestore user document in `users/{uid}` collection
   - Sets `role = 'member'` automatically
   - Firebase Auth state changes, triggering `onAuthStateChanged`
   - User document fetched from Firestore
   - Redirects to `/home`

### Login Flow
1. User enters email and password
2. Calls `login(email, password)`
3. Firebase Auth signs in user
4. Fetches user document from Firestore
5. `onAuthStateChanged` listener updates auth context
6. Redirects to `/home`

### Persistent Login
- Firebase Auth automatically persists session in browser
- On app load, `onAuthStateChanged` fires immediately
- If user is signed in, fetches user document from Firestore
- User remains logged in across page refreshes until explicit logout

### Logout Flow
1. Calls `signOut()` from Firebase Auth
2. `onAuthStateChanged` listener detects sign-out
3. Auth context `user` set to `null`
4. Redirects to `/login`

## Error Handling

**Signup Errors:**
- Invalid email format → "Invalid email address"
- Weak password (< 6 chars) → "Password must be at least 6 characters"
- Email already exists → "Email already in use"
- Passwords don't match → "Passwords do not match"
- Missing required fields → Specific field error

**Login Errors:**
- Invalid email format → "Invalid email format"
- User not found → "User not found"
- Wrong password → "Invalid email or password"
- Invalid credentials → "Invalid email or password"

All errors displayed inline below form fields.

## Role Handling

- **Default Role**: All new users get `role = 'member'` during signup
- **Admin Role**: Cannot be assigned during signup (enforced in Firestore rules)
- **Role Assignment**: Will be handled later when user creates a group (future feature)
- **UI Respects Role**: Admin-only options can be conditionally hidden based on `user.role`

## Currency Support

**Supported Currencies:**
- USD (US Dollar)
- INR (Indian Rupee)
- EUR (Euro)
- GBP (British Pound)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)

Currency selector is a dropdown in Signup Screen 2. Currency is required and stored in user document.

## Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Get these values from: Firebase Console > Project Settings > General > Your apps

## Firestore Setup

1. Create a Firestore database in your Firebase project
2. Deploy the security rules (`firestore.rules`) to your project:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. The `users` collection will be created automatically when first user signs up

## Testing the Implementation

1. **Start the app:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. **Test Signup:**
   - Navigate to `/signup`
   - Enter email, password, confirm password → Click "Next"
   - Enter name, select currency → Click "Create Account"
   - Should redirect to `/home` and display user info

3. **Test Login:**
   - Navigate to `/login`
   - Enter credentials from signup → Click "Login"
   - Should redirect to `/home`

4. **Test Persistent Login:**
   - After logging in, refresh the page
   - User should remain logged in (no redirect to login)

5. **Test Logout:**
   - Click "Logout" on home screen
   - Should redirect to `/login`
   - User should not be able to access `/home` without logging in again

## UI Design Notes

- **Clean, minimal design** (Splitwise-like)
- **Mobile-first** responsive layout
- **Simple input fields** with clear labels
- **Currency picker** as standard dropdown
- **Primary CTA buttons** (blue background, white text)
- **Inline error messages** (red text, light red background)
- **No animations** as requested
- **Proper form validation** with helpful error messages

## Next Steps (Not Implemented)

- Social login (Facebook, Google, etc.)
- Phone authentication
- Password reset functionality
- Email verification
- Payment API integration
- Group invite logic
- Admin role assignment (when creating groups)

## Summary

The authentication system is fully functional with:
✅ Email + password signup (2-screen flow)
✅ Email + password login
✅ Persistent login (survives page refresh)
✅ Proper error handling
✅ User model in Firestore
✅ Role system (member by default, admin reserved)
✅ Protected routes
✅ Clean, minimal UI
✅ Firestore security rules

All requirements have been met and the app is ready for further development.
