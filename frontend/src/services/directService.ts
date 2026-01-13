import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface DirectThread {
  id: string;
  memberIds: string[]; // Always length 2, sorted
  createdBy: string;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Find or create a direct thread between two users
 * Enforces that memberIds has exactly length 2
 */
export async function findOrCreateDirectThread(
  userId1: string,
  userId2: string
): Promise<DirectThread> {
  if (userId1 === userId2) {
    throw new Error('Cannot create direct thread with yourself');
  }

  // Sort member IDs for deterministic lookup
  const memberIds = [userId1, userId2].sort();

  // Try to find existing thread
  const threadsQuery = query(
    collection(db, 'directThreads'),
    where('memberIds', '==', memberIds)
  );

  const threadsSnapshot = await getDocs(threadsQuery);

  if (!threadsSnapshot.empty) {
    const threadDoc = threadsSnapshot.docs[0];
    const data = threadDoc.data();
    return {
      id: threadDoc.id,
      memberIds: data.memberIds,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastActivityAt: data.lastActivityAt?.toDate() || new Date(),
    };
  }

  // Create new thread
  const threadRef = doc(collection(db, 'directThreads'));
  const now = serverTimestamp();
  const threadData = {
    memberIds,
    createdBy: userId1, // Current user creates the thread
    createdAt: now,
    lastActivityAt: now,
  };

  await setDoc(threadRef, threadData);

  return {
    id: threadRef.id,
    memberIds,
    createdBy: userId1,
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };
}

/**
 * List all direct threads for a user
 */
export async function listDirectThreadsForUser(userId: string): Promise<DirectThread[]> {
  // Query threads where user is in memberIds array
  const threadsQuery = query(
    collection(db, 'directThreads'),
    where('memberIds', 'array-contains', userId)
  );

  const threadsSnapshot = await getDocs(threadsQuery);
  const threads: DirectThread[] = [];

  for (const threadDoc of threadsSnapshot.docs) {
    const data = threadDoc.data();
    threads.push({
      id: threadDoc.id,
      memberIds: data.memberIds,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastActivityAt: data.lastActivityAt?.toDate() || new Date(),
    });
  }

  return threads;
}

/**
 * Get a direct thread by ID
 */
export async function getDirectThread(threadId: string): Promise<DirectThread | null> {
  const threadDoc = await getDoc(doc(db, 'directThreads', threadId));
  if (!threadDoc.exists()) {
    return null;
  }

  const data = threadDoc.data();
  return {
    id: threadDoc.id,
    memberIds: data.memberIds,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate() || new Date(),
    lastActivityAt: data.lastActivityAt?.toDate() || new Date(),
  };
}

/**
 * Update lastActivityAt for a direct thread
 */
export async function updateDirectThreadActivity(threadId: string): Promise<void> {
  await updateDoc(doc(db, 'directThreads', threadId), {
    lastActivityAt: serverTimestamp(),
  });
}
