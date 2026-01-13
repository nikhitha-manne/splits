import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type AuthError,
  AuthErrorCodes,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type UserRole = 'admin' | 'member';

export interface User {
  uid: string;
  name: string;
  email: string;
  defaultCurrency: string;
  role: UserRole;
  phone?: string;
  profilePhotoUrl?: string;
  createdAt: Date;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  defaultCurrency: string;
}

/**
 * Get user-friendly error message from Firebase Auth error
 */
export function getAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case AuthErrorCodes.INVALID_EMAIL:
      return 'Invalid email address';
    case AuthErrorCodes.EMAIL_EXISTS:
      return 'Email already in use';
    case AuthErrorCodes.WEAK_PASSWORD:
      return 'Password should be at least 6 characters';
    case AuthErrorCodes.USER_DELETED:
      return 'User not found';
    case AuthErrorCodes.INVALID_PASSWORD:
      return 'Invalid password';
    case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
      return 'Invalid email or password';
    default:
      return error.message || 'An error occurred during authentication';
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; message?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  return { valid: true };
}

/**
 * Create or update user document in Firestore
 * Helper function for creating user documents with safe defaults
 */
async function createUserDocument(
  uid: string,
  email: string,
  name: string,
  defaultCurrency: string,
  role: UserRole = 'member'
): Promise<void> {
  const userData = {
    uid,
    email,
    name,
    defaultCurrency,
    role,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', uid), userData);
}

/**
 * Sign up with email and password
 * Creates Firebase Auth user and Firestore user document
 */
export async function signup(data: SignupData): Promise<User> {
  // Validate email
  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) {
    throw new Error(emailValidation.message);
  }

  // Validate password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message);
  }

  let firebaseUser;
  
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    firebaseUser = userCredential.user;

    // Update Firebase Auth profile with display name
    await updateProfile(firebaseUser, {
      displayName: data.name,
    });
  } catch (error: any) {
    // Firebase Auth error handling
    if (error.code && error.message) {
      throw new Error(getAuthErrorMessage(error));
    }
    throw new Error(error.message || 'Failed to create account');
  }

  // Create Firestore user document with error handling
  try {
    await createUserDocument(
      firebaseUser.uid,
      data.email,
      data.name,
      data.defaultCurrency,
      'member'
    );
  } catch (error: any) {
    // If Firestore write fails, we should handle it gracefully
    // But note: Firebase Auth user is already created at this point
    console.error('Failed to create user document in Firestore:', error);
    throw new Error('Failed to create user profile. Please try logging in again.');
  }

  // Return user object
  const user: User = {
    uid: firebaseUser.uid,
    name: data.name,
    email: data.email,
    defaultCurrency: data.defaultCurrency,
    role: 'member',
    phone: undefined,
    profilePhotoUrl: undefined,
    createdAt: new Date(),
  };

  return user;
}

/**
 * Sign in with email and password
 * Fetches user document from Firestore, creates it if missing (self-heal)
 */
export async function login(email: string, password: string): Promise<User> {
  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    throw new Error(emailValidation.message);
  }

  let firebaseUser;

  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    firebaseUser = userCredential.user;
  } catch (error: any) {
    // Firebase Auth error handling
    if (error.code && error.message) {
      throw new Error(getAuthErrorMessage(error));
    }
    throw new Error(error.message || 'Login failed');
  }

  // Fetch user document from Firestore
  try {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    if (!userDoc.exists()) {
      // Self-heal: Create user document with safe defaults
      try {
        await createUserDocument(
          firebaseUser.uid,
          firebaseUser.email || email,
          firebaseUser.displayName || 'User',
          'USD', // Safe default currency
          'member'
        );
        
        // Fetch the newly created document
        const newUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = newUserDoc.data()!;
        
        return {
          uid: userData.uid,
          name: userData.name,
          email: userData.email,
          defaultCurrency: userData.defaultCurrency,
          role: userData.role || 'member',
          phone: userData.phone,
          profilePhotoUrl: userData.profilePhotoUrl,
          createdAt: userData.createdAt?.toDate() || new Date(),
        };
      } catch (createError) {
        console.error('Failed to create user document during login:', createError);
        throw new Error('Failed to initialize user profile. Please try again.');
      }
    }

    const userData = userDoc.data();
    // Backward compatibility: ignore dietaryPreference if present in old docs
    return {
      uid: userData.uid,
      name: userData.name,
      email: userData.email,
      defaultCurrency: userData.defaultCurrency,
      role: userData.role || 'member',
      createdAt: userData.createdAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error('Error fetching user document:', error);
    throw new Error(error.message || 'Failed to load user profile');
  }
}

/**
 * Sign out current user
 */
export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message || 'Logout failed');
  }
}

/**
 * Get current user from Firestore
 * Creates user document if missing (self-heal)
 */
export async function getCurrentUser(): Promise<User | null> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    return null;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (!userDoc.exists()) {
      // Self-heal: Create user document with safe defaults
      try {
        await createUserDocument(
          firebaseUser.uid,
          firebaseUser.email || '',
          firebaseUser.displayName || 'User',
          'USD', // Safe default currency
          'member'
        );
        
        // Fetch the newly created document
        const newUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = newUserDoc.data()!;
        
        return {
          uid: userData.uid,
          name: userData.name,
          email: userData.email,
          defaultCurrency: userData.defaultCurrency,
          role: userData.role || 'member',
          phone: userData.phone,
          profilePhotoUrl: userData.profilePhotoUrl,
          createdAt: userData.createdAt?.toDate() || new Date(),
        };
      } catch (createError) {
        console.error('Failed to create user document:', createError);
        return null;
      }
    }

    const userData = userDoc.data();
    // Backward compatibility: ignore dietaryPreference if present in old docs
    return {
      uid: userData.uid,
      name: userData.name,
      email: userData.email,
      defaultCurrency: userData.defaultCurrency,
      role: userData.role || 'member',
      phone: userData.phone,
      profilePhotoUrl: userData.profilePhotoUrl,
      createdAt: userData.createdAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

/**
 * Update user profile in Firestore
 */
export async function updateUserProfile(updates: {
  name?: string;
  defaultCurrency?: string;
  phone?: string | null;
  profilePhotoUrl?: string | null;
}): Promise<User> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    throw new Error('User not authenticated');
  }

  const userId = firebaseUser.uid;

  // Validate required fields
  if (updates.name !== undefined && !updates.name.trim()) {
    throw new Error('Name is required');
  }

  if (updates.defaultCurrency !== undefined && !updates.defaultCurrency.trim()) {
    throw new Error('Default currency is required');
  }

  const batch = writeBatch(db);

  // Prepare update data for private user document (only include fields that are defined)
  const userUpdateData: Record<string, any> = {};
  if (updates.name !== undefined) {
    userUpdateData.name = updates.name.trim();
  }
  if (updates.defaultCurrency !== undefined) {
    userUpdateData.defaultCurrency = updates.defaultCurrency.trim();
  }
  if (updates.phone !== undefined) {
    userUpdateData.phone = updates.phone?.trim() || null;
  }
  if (updates.profilePhotoUrl !== undefined) {
    userUpdateData.profilePhotoUrl = updates.profilePhotoUrl?.trim() || null;
  }

  // Update private user document
  if (Object.keys(userUpdateData).length > 0) {
    batch.update(doc(db, 'users', userId), userUpdateData);
  }

  // Prepare update data for public user profile (only display fields)
  const publicUpdateData: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.name !== undefined) {
    publicUpdateData.name = updates.name.trim();
  }
  if (updates.profilePhotoUrl !== undefined) {
    publicUpdateData.profilePhotoUrl = updates.profilePhotoUrl?.trim() || null;
  }

  // Update public user profile
  if (Object.keys(publicUpdateData).length > 1) {
    // Only update if there are fields other than updatedAt
    batch.update(doc(db, 'publicUsers', userId), publicUpdateData);
  }

  // Commit batch
  await batch.commit();

  // Fetch and return updated user from private document
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('User document not found');
  }

  const userData = userDoc.data();
  return {
    uid: userData.uid,
    name: userData.name,
    email: userData.email,
    defaultCurrency: userData.defaultCurrency,
    role: userData.role || 'member',
    phone: userData.phone,
    profilePhotoUrl: userData.profilePhotoUrl,
    createdAt: userData.createdAt?.toDate() || new Date(),
  };
}
