/**
 * Bill upload and item-based splitting service
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

export type ContainerType = 'group' | 'direct';
export type OcrStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'MANUAL';

export interface BillUpload {
  id: string;
  containerType: ContainerType;
  groupId?: string;
  directId?: string;
  createdBy: string;
  imageUrl: string;
  currency: string;
  ocrStatus: OcrStatus;
  rawOcrText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
  orderIndex: number;
}

export interface ItemAssignment {
  userId: string;
  share: number; // Amount of this item assigned to this user, in bill currency
}

export interface CreateBillUploadInput {
  containerType: ContainerType;
  groupId?: string;
  directId?: string;
  createdBy: string;
  currency: string;
}

/**
 * Create a bill upload document
 */
export async function createBillUpload(input: CreateBillUploadInput): Promise<string> {
  const { containerType, groupId, directId, createdBy, currency } = input;

  if (containerType === 'group' && !groupId) {
    throw new Error('groupId is required for group bills');
  }

  if (containerType === 'direct' && !directId) {
    throw new Error('directId is required for direct bills');
  }

  const now = serverTimestamp();
  const billUploadRef = doc(collection(db, 'billUploads'));
  const billUploadData: any = {
    containerType,
    createdBy,
    currency,
    ocrStatus: 'MANUAL' as OcrStatus,
    createdAt: now,
    updatedAt: now,
  };

  if (containerType === 'group') {
    billUploadData.groupId = groupId;
  } else {
    billUploadData.directId = directId;
  }

  await setDoc(billUploadRef, billUploadData);

  return billUploadRef.id;
}

/**
 * Upload bill image to Firebase Storage
 */
export async function uploadBillImage(file: File, billUploadId: string): Promise<string> {
  const storageRef = ref(storage, `billUploads/${billUploadId}/${file.name}`);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);
  
  // Update bill upload with image URL
  await updateDoc(doc(db, 'billUploads', billUploadId), {
    imageUrl,
    updatedAt: serverTimestamp(),
  });

  return imageUrl;
}

/**
 * Get a bill upload by ID
 */
export async function getBillUpload(billUploadId: string): Promise<BillUpload | null> {
  const billUploadDoc = await getDoc(doc(db, 'billUploads', billUploadId));

  if (!billUploadDoc.exists()) {
    return null;
  }

  const data = billUploadDoc.data();
  return {
    id: billUploadDoc.id,
    containerType: data.containerType,
    groupId: data.groupId,
    directId: data.directId,
    createdBy: data.createdBy,
    imageUrl: data.imageUrl,
    currency: data.currency,
    ocrStatus: data.ocrStatus,
    rawOcrText: data.rawOcrText,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

/**
 * Add or update a bill item
 */
export async function addOrUpdateItem(
  billUploadId: string,
  item: { id?: string; name: string; price: number; orderIndex: number }
): Promise<string> {
  const itemsCollection = collection(db, 'billUploads', billUploadId, 'items');
  
  if (item.id) {
    // Update existing item
    await setDoc(doc(itemsCollection, item.id), {
      name: item.name,
      price: item.price,
      orderIndex: item.orderIndex,
    });
    return item.id;
  } else {
    // Create new item
    const itemRef = doc(itemsCollection);
    await setDoc(itemRef, {
      name: item.name,
      price: item.price,
      orderIndex: item.orderIndex,
    });
    return itemRef.id;
  }
}

/**
 * List all items for a bill upload
 */
export async function listItems(billUploadId: string): Promise<BillItem[]> {
  const itemsQuery = query(
    collection(db, 'billUploads', billUploadId, 'items'),
    orderBy('orderIndex', 'asc')
  );

  const itemsSnapshot = await getDocs(itemsQuery);
  const items: BillItem[] = [];

  for (const itemDoc of itemsSnapshot.docs) {
    const data = itemDoc.data();
    items.push({
      id: itemDoc.id,
      name: data.name,
      price: data.price,
      orderIndex: data.orderIndex,
    });
  }

  return items;
}

/**
 * Delete a bill item (soft delete by removing from collection)
 */
export async function deleteItem(billUploadId: string, itemId: string): Promise<void> {
  // Also delete all assignments for this item
  const assignmentsQuery = query(
    collection(db, 'billUploads', billUploadId, 'items', itemId, 'assignments')
  );
  const assignmentsSnapshot = await getDocs(assignmentsQuery);
  
  for (const assignmentDoc of assignmentsSnapshot.docs) {
    await deleteDoc(assignmentDoc.ref);
  }

  // Delete the item
  await deleteDoc(doc(db, 'billUploads', billUploadId, 'items', itemId));
}

/**
 * Set item assignments for a specific item
 */
export async function setItemAssignments(
  billUploadId: string,
  itemId: string,
  assignments: ItemAssignment[]
): Promise<void> {
  // Delete existing assignments
  const assignmentsQuery = query(
    collection(db, 'billUploads', billUploadId, 'items', itemId, 'assignments')
  );
  const assignmentsSnapshot = await getDocs(assignmentsQuery);
  
  for (const assignmentDoc of assignmentsSnapshot.docs) {
    await deleteDoc(assignmentDoc.ref);
  }

  // Create new assignments
  for (const assignment of assignments) {
    await setDoc(
      doc(db, 'billUploads', billUploadId, 'items', itemId, 'assignments', assignment.userId),
      {
        userId: assignment.userId,
        share: assignment.share,
      }
    );
  }
}

/**
 * Get item assignments for a specific item
 */
export async function getItemAssignments(
  billUploadId: string,
  itemId: string
): Promise<ItemAssignment[]> {
  const assignmentsQuery = query(
    collection(db, 'billUploads', billUploadId, 'items', itemId, 'assignments')
  );
  const assignmentsSnapshot = await getDocs(assignmentsQuery);
  
  const assignments: ItemAssignment[] = [];
  for (const assignmentDoc of assignmentsSnapshot.docs) {
    const data = assignmentDoc.data();
    assignments.push({
      userId: data.userId,
      share: data.share,
    });
  }

  return assignments;
}

/**
 * Compute total owed amounts per user from all items and their assignments
 * Uses domain/itemTotals for pure computation logic
 */
export async function computeTotals(billUploadId: string): Promise<Map<string, number>> {
  const items = await listItems(billUploadId);
  const assignmentsMap = new Map<string, ItemAssignment[]>();

  // Load all assignments
  for (const item of items) {
    const assignments = await getItemAssignments(billUploadId, item.id);
    assignmentsMap.set(item.id, assignments);
  }

  // Use domain logic for computation
  const { computeItemTotals } = await import('../domain/itemTotals');
  
  // Types are compatible between billService and domain/itemTotals
  return computeItemTotals(items, assignmentsMap);
}

/**
 * Update bill upload OCR status
 */
export async function updateBillUploadOcrStatus(
  billUploadId: string,
  ocrStatus: OcrStatus,
  rawOcrText?: string
): Promise<void> {
  const updateData: any = {
    ocrStatus,
    updatedAt: serverTimestamp(),
  };

  if (rawOcrText !== undefined) {
    updateData.rawOcrText = rawOcrText;
  }

  await updateDoc(doc(db, 'billUploads', billUploadId), updateData);
}
