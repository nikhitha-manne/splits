/**
 * Settlement service - handles manual payment tracking and reversals
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { normalizeAmount, type Currency, isValidCurrency } from './currencyService';

export type ContainerType = 'group' | 'direct';

export type SettlementStatus = 'COMPLETED' | 'REVERSED';

export interface Settlement {
  id: string;
  containerType: ContainerType;
  groupId?: string;
  directId?: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  normalizedFromAmount: number;
  normalizedToAmount: number;
  conversionRateFrom: number;
  conversionRateTo: number;
  createdAt: Date;
  createdBy: string;
  status: SettlementStatus;
  reversedAt?: Date;
  reversedBy?: string;
  note?: string;
}

export interface CreateSettlementInput {
  containerType: ContainerType;
  groupId?: string;
  directId?: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: Currency;
  createdBy: string;
  note?: string;
}

/**
 * Get user default currency
 */
async function getUserDefaultCurrency(userId: string): Promise<string> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    return 'USD'; // Default fallback
  }
  return userDoc.data().defaultCurrency || 'USD';
}

/**
 * Create a settlement
 */
export async function createSettlement(input: CreateSettlementInput): Promise<string> {
  const { containerType, groupId, directId, fromUserId, toUserId, amount, currency, createdBy, note } = input;

  // Validate
  if (fromUserId === toUserId) {
    throw new Error('Cannot create settlement between the same user');
  }

  if (amount <= 0) {
    throw new Error('Settlement amount must be greater than 0');
  }

  if (!isValidCurrency(currency)) {
    throw new Error(`Invalid currency: ${currency}`);
  }

  if (containerType === 'group' && !groupId) {
    throw new Error('groupId is required for group settlements');
  }

  if (containerType === 'direct' && !directId) {
    throw new Error('directId is required for direct settlements');
  }

  // Get user currencies and normalize amounts
  const [fromUserCurrency, toUserCurrency] = await Promise.all([
    getUserDefaultCurrency(fromUserId),
    getUserDefaultCurrency(toUserId),
  ]);

  const normalizedFrom = normalizeAmount(amount, currency, fromUserCurrency as Currency);
  const normalizedTo = normalizeAmount(amount, currency, toUserCurrency as Currency);

  const now = serverTimestamp();

  // Create settlement document
  const settlementRef = doc(collection(db, 'settlements'));
  const settlementData: any = {
    containerType,
    fromUserId,
    toUserId,
    amount,
    currency,
    normalizedFromAmount: normalizedFrom.convertedAmount,
    normalizedToAmount: normalizedTo.convertedAmount,
    conversionRateFrom: normalizedFrom.rate,
    conversionRateTo: normalizedTo.rate,
    createdAt: now,
    createdBy,
    status: 'COMPLETED',
    reversedAt: null,
    reversedBy: null,
    note: note || null,
  };

  if (containerType === 'group') {
    settlementData.groupId = groupId;
  } else {
    settlementData.directId = directId;
  }

  await setDoc(settlementRef, settlementData);

  return settlementRef.id;
}

/**
 * List settlements for a group
 */
export async function listSettlementsForGroup(groupId: string): Promise<Settlement[]> {
  const settlementsQuery = query(
    collection(db, 'settlements'),
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc')
  );

  const settlementsSnapshot = await getDocs(settlementsQuery);
  const settlements: Settlement[] = [];

  for (const settlementDoc of settlementsSnapshot.docs) {
    const data = settlementDoc.data();
    settlements.push({
      id: settlementDoc.id,
      containerType: 'group',
      groupId: data.groupId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      amount: data.amount,
      currency: data.currency,
      normalizedFromAmount: data.normalizedFromAmount,
      normalizedToAmount: data.normalizedToAmount,
      conversionRateFrom: data.conversionRateFrom,
      conversionRateTo: data.conversionRateTo,
      createdAt: data.createdAt?.toDate() || new Date(),
      createdBy: data.createdBy,
      status: data.status,
      reversedAt: data.reversedAt?.toDate(),
      reversedBy: data.reversedBy,
      note: data.note,
    });
  }

  return settlements;
}

/**
 * List settlements for a direct thread
 */
export async function listSettlementsForDirect(directId: string): Promise<Settlement[]> {
  const settlementsQuery = query(
    collection(db, 'settlements'),
    where('directId', '==', directId),
    orderBy('createdAt', 'desc')
  );

  const settlementsSnapshot = await getDocs(settlementsQuery);
  const settlements: Settlement[] = [];

  for (const settlementDoc of settlementsSnapshot.docs) {
    const data = settlementDoc.data();
    settlements.push({
      id: settlementDoc.id,
      containerType: 'direct',
      directId: data.directId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      amount: data.amount,
      currency: data.currency,
      normalizedFromAmount: data.normalizedFromAmount,
      normalizedToAmount: data.normalizedToAmount,
      conversionRateFrom: data.conversionRateFrom,
      conversionRateTo: data.conversionRateTo,
      createdAt: data.createdAt?.toDate() || new Date(),
      createdBy: data.createdBy,
      status: data.status,
      reversedAt: data.reversedAt?.toDate(),
      reversedBy: data.reversedBy,
      note: data.note,
    });
  }

  return settlements;
}

/**
 * Reverse a settlement
 */
export async function reverseSettlement(settlementId: string, reversedBy: string): Promise<void> {
  const settlementDoc = await getDoc(doc(db, 'settlements', settlementId));

  if (!settlementDoc.exists()) {
    throw new Error('Settlement not found');
  }

  const settlementData = settlementDoc.data();

  if (settlementData.status === 'REVERSED') {
    throw new Error('Settlement is already reversed');
  }

  await updateDoc(doc(db, 'settlements', settlementId), {
    status: 'REVERSED',
    reversedAt: serverTimestamp(),
    reversedBy,
  });
}

/**
 * Get a settlement by ID
 */
export async function getSettlement(settlementId: string): Promise<Settlement | null> {
  const settlementDoc = await getDoc(doc(db, 'settlements', settlementId));

  if (!settlementDoc.exists()) {
    return null;
  }

  const data = settlementDoc.data();
  return {
    id: settlementDoc.id,
    containerType: data.containerType,
    groupId: data.groupId,
    directId: data.directId,
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    amount: data.amount,
    currency: data.currency,
    normalizedFromAmount: data.normalizedFromAmount,
    normalizedToAmount: data.normalizedToAmount,
    conversionRateFrom: data.conversionRateFrom,
    conversionRateTo: data.conversionRateTo,
    createdAt: data.createdAt?.toDate() || new Date(),
    createdBy: data.createdBy,
    status: data.status,
    reversedAt: data.reversedAt?.toDate(),
    reversedBy: data.reversedBy,
    note: data.note,
  };
}
