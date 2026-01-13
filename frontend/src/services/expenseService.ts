import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { calculateSplit, type SplitType, type SplitParticipant } from './splitCalculator';
import { normalizeAmount, type Currency, isValidCurrency } from './currencyService';
import { updateDirectThreadActivity } from './directService';

export type ContainerType = 'group' | 'direct';

export interface Expense {
  id: string;
  containerType: ContainerType;
  groupId?: string;
  directId?: string;
  title: string;
  description?: string;
  currency: string;
  totalAmount: number;
  splitType: SplitType;
  participantIds: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  editedFlag: boolean;
  editedAt?: Date;
}

export interface ExpensePayer {
  userId: string;
  amount: number; // Amount in expense currency
}

export interface ExpenseSplit {
  userId: string;
  amountInExpenseCurrency: number;
  normalizedAmount: number;
  normalizedCurrency: string;
  conversionRate: number;
  conversionTimestamp: Date;
}

export interface Balance {
  userId: string;
  netAmount: number; // Positive = user gets, Negative = user owes (in user's default currency)
  currency: string; // User's default currency
}

export interface CreateExpenseInput {
  containerType: ContainerType;
  groupId?: string;
  directId?: string;
  title: string;
  description?: string;
  amount: number;
  currency: Currency;
  splitType: SplitType;
  participants: SplitParticipant[];
  payers: ExpensePayer[];
  createdBy: string;
}

/**
 * Get user document by email (helper for user search)
 */
export async function getUserByEmail(email: string): Promise<{ uid: string; name: string; email: string; defaultCurrency: string } | null> {
  const usersQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
  const usersSnapshot = await getDocs(usersQuery);

  if (usersSnapshot.empty) {
    return null;
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  return {
    uid: userDoc.id,
    name: userData.name,
    email: userData.email,
    defaultCurrency: userData.defaultCurrency,
  };
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
 * Create an expense with payers and splits
 */
export async function createExpense(input: CreateExpenseInput): Promise<string> {
  const { containerType, groupId, directId, title, description, amount, currency, splitType, participants, payers, createdBy } = input;

  // Validate currency
  if (!isValidCurrency(currency)) {
    throw new Error(`Invalid currency: ${currency}`);
  }

  // Validate payers sum equals total amount
  const payersSum = payers.reduce((sum, p) => sum + p.amount, 0);
  if (Math.abs(payersSum - amount) > 0.01) {
    throw new Error(`Payers sum (${payersSum.toFixed(2)}) does not equal expense amount (${amount.toFixed(2)})`);
  }

  // Validate container
  if (containerType === 'group' && !groupId) {
    throw new Error('groupId is required for group expenses');
  }
  if (containerType === 'direct' && !directId) {
    throw new Error('directId is required for direct expenses');
  }

  // Calculate splits
  const splits = calculateSplit(amount, splitType, participants);
  const participantIds = participants.map((p) => p.userId);

  const now = serverTimestamp();

  // Create expense document
  const expenseRef = doc(collection(db, 'expenses'));
  const expenseData: any = {
    containerType,
    title,
    description: description || null,
    currency,
    totalAmount: amount,
    splitType,
    participantIds,
    createdBy,
    createdAt: now,
    updatedAt: now,
    editedFlag: false,
    editedAt: null,
  };

  if (containerType === 'group') {
    expenseData.groupId = groupId;
  } else {
    expenseData.directId = directId;
  }

  await setDoc(expenseRef, expenseData);
  const expenseId = expenseRef.id;

  // Create payer documents
  for (const payer of payers) {
    await setDoc(doc(db, 'expenses', expenseId, 'payers', payer.userId), {
      userId: payer.userId,
      amount: payer.amount,
    });
  }

  // Create split documents with normalized amounts
  for (const split of splits) {
    const userCurrency = await getUserDefaultCurrency(split.userId);
    const conversion = normalizeAmount(split.amount, currency, userCurrency as Currency);

    await setDoc(doc(db, 'expenses', expenseId, 'splits', split.userId), {
      userId: split.userId,
      amountInExpenseCurrency: split.amount,
      normalizedAmount: conversion.convertedAmount,
      normalizedCurrency: userCurrency,
      conversionRate: conversion.rate,
      conversionTimestamp: conversion.timestamp,
    });
  }

  // Update container lastActivityAt
  if (containerType === 'direct' && directId) {
    await updateDirectThreadActivity(directId);
  }

  return expenseId;
}

/**
 * Edit an expense (recomputes splits, sets editedFlag)
 */
export async function editExpense(
  expenseId: string,
  input: Partial<CreateExpenseInput>
): Promise<void> {
  const expenseDoc = await getDoc(doc(db, 'expenses', expenseId));
  if (!expenseDoc.exists()) {
    throw new Error('Expense not found');
  }

  const existingData = expenseDoc.data() as Expense;
  const now = serverTimestamp();

  // Merge with existing data
  const updatedData: any = {
    ...existingData,
    updatedAt: now,
    editedFlag: true,
    editedAt: now,
  };

  if (input.title !== undefined) updatedData.title = input.title;
  if (input.description !== undefined) updatedData.description = input.description || null;
  if (input.amount !== undefined) updatedData.totalAmount = input.amount;
  if (input.currency !== undefined) {
    if (!isValidCurrency(input.currency)) {
      throw new Error(`Invalid currency: ${input.currency}`);
    }
    updatedData.currency = input.currency;
  }
  if (input.splitType !== undefined) updatedData.splitType = input.splitType;
  if (input.participants !== undefined) {
    updatedData.participantIds = input.participants.map((p) => p.userId);
  }

  // If amount, currency, splitType, or participants changed, recompute splits
  const needsRecalculation =
    input.amount !== undefined ||
    input.currency !== undefined ||
    input.splitType !== undefined ||
    input.participants !== undefined;

  if (needsRecalculation && input.participants && input.amount !== undefined && input.splitType) {
    // Recalculate splits
    const splits = calculateSplit(input.amount, input.splitType || existingData.splitType, input.participants);

    // Delete old splits
    const oldSplitsSnapshot = await getDocs(collection(db, 'expenses', expenseId, 'splits'));
    for (const oldSplitDoc of oldSplitsSnapshot.docs) {
      await updateDoc(doc(db, 'expenses', expenseId, 'splits', oldSplitDoc.id), {
        userId: null, // Mark as deleted (can't actually delete)
      });
    }

    // Create new splits
    for (const split of splits) {
      const userCurrency = await getUserDefaultCurrency(split.userId);
      const conversion = normalizeAmount(split.amount, updatedData.currency, userCurrency as Currency);

      await setDoc(doc(db, 'expenses', expenseId, 'splits', split.userId), {
        userId: split.userId,
        amountInExpenseCurrency: split.amount,
        normalizedAmount: conversion.convertedAmount,
        normalizedCurrency: userCurrency,
        conversionRate: conversion.rate,
        conversionTimestamp: conversion.timestamp,
      });
    }
  }

  // Update payers if provided
  if (input.payers !== undefined) {
    // Validate payers sum
    const payersSum = input.payers.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(payersSum - updatedData.totalAmount) > 0.01) {
      throw new Error(`Payers sum (${payersSum.toFixed(2)}) does not equal expense amount (${updatedData.totalAmount.toFixed(2)})`);
    }

    // Delete old payers (by setting amount to 0, can't actually delete)
    const oldPayersSnapshot = await getDocs(collection(db, 'expenses', expenseId, 'payers'));
    for (const oldPayerDoc of oldPayersSnapshot.docs) {
      await updateDoc(doc(db, 'expenses', expenseId, 'payers', oldPayerDoc.id), {
        userId: null, // Mark as deleted
      });
    }

    // Create new payers
    for (const payer of input.payers) {
      await setDoc(doc(db, 'expenses', expenseId, 'payers', payer.userId), {
        userId: payer.userId,
        amount: payer.amount,
      });
    }
  }

  // Update expense document
  await updateDoc(doc(db, 'expenses', expenseId), updatedData);

  // Update container lastActivityAt
  if (updatedData.containerType === 'direct' && updatedData.directId) {
    await updateDirectThreadActivity(updatedData.directId);
  }
}

/**
 * List expenses for a group
 */
export async function listExpensesForGroup(groupId: string): Promise<Expense[]> {
  const expensesQuery = query(
    collection(db, 'expenses'),
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc')
  );

  const expensesSnapshot = await getDocs(expensesQuery);
  const expenses: Expense[] = [];

  for (const expenseDoc of expensesSnapshot.docs) {
    const data = expenseDoc.data();
    expenses.push({
      id: expenseDoc.id,
      containerType: 'group',
      groupId: data.groupId,
      title: data.title,
      description: data.description,
      currency: data.currency,
      totalAmount: data.totalAmount,
      splitType: data.splitType,
      participantIds: data.participantIds,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      editedFlag: data.editedFlag || false,
      editedAt: data.editedAt?.toDate(),
    });
  }

  return expenses;
}

/**
 * List expenses for a direct thread
 */
export async function listExpensesForDirect(directId: string): Promise<Expense[]> {
  const expensesQuery = query(
    collection(db, 'expenses'),
    where('directId', '==', directId),
    orderBy('createdAt', 'desc')
  );

  const expensesSnapshot = await getDocs(expensesQuery);
  const expenses: Expense[] = [];

  for (const expenseDoc of expensesSnapshot.docs) {
    const data = expenseDoc.data();
    expenses.push({
      id: expenseDoc.id,
      containerType: 'direct',
      directId: data.directId,
      title: data.title,
      description: data.description,
      currency: data.currency,
      totalAmount: data.totalAmount,
      splitType: data.splitType,
      participantIds: data.participantIds,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      editedFlag: data.editedFlag || false,
      editedAt: data.editedAt?.toDate(),
    });
  }

  return expenses;
}

/**
 * Get balances for a group (all members)
 */
export async function getBalancesForGroup(groupId: string, _viewerCurrency: string): Promise<Balance[]> {
  const expenses = await listExpensesForGroup(groupId);
  const balancesMap = new Map<string, { paid: number; owed: number; currency: string; settlementsPaid: number; settlementsReceived: number }>();

  // Process all expenses
  for (const expense of expenses) {
    // Get payers
    const payersSnapshot = await getDocs(collection(db, 'expenses', expense.id, 'payers'));
    for (const payerDoc of payersSnapshot.docs) {
      const payerData = payerDoc.data();
      if (!payerData.userId) continue; // Skip deleted payers

      const userCurrency = await getUserDefaultCurrency(payerData.userId);
      const normalizedPaid = normalizeAmount(payerData.amount, expense.currency as Currency, userCurrency as Currency);

      if (!balancesMap.has(payerData.userId)) {
        balancesMap.set(payerData.userId, { paid: 0, owed: 0, currency: userCurrency, settlementsPaid: 0, settlementsReceived: 0 });
      }
      const balance = balancesMap.get(payerData.userId)!;
      balance.paid += normalizedPaid.convertedAmount;
    }

    // Get splits
    const splitsSnapshot = await getDocs(collection(db, 'expenses', expense.id, 'splits'));
    for (const splitDoc of splitsSnapshot.docs) {
      const splitData = splitDoc.data();
      if (!splitData.userId) continue; // Skip deleted splits

      if (!balancesMap.has(splitData.userId)) {
        balancesMap.set(splitData.userId, { paid: 0, owed: 0, currency: splitData.normalizedCurrency, settlementsPaid: 0, settlementsReceived: 0 });
      }
      const balance = balancesMap.get(splitData.userId)!;
      balance.owed += splitData.normalizedAmount;
    }
  }

  // Process settlements (only COMPLETED status)
  const { listSettlementsForGroup } = await import('./settlementService');
  const settlements = await listSettlementsForGroup(groupId);
  for (const settlement of settlements) {
    if (settlement.status !== 'COMPLETED') continue;

    // fromUserId paid, subtract normalizedFromAmount
    if (!balancesMap.has(settlement.fromUserId)) {
      const userCurrency = await getUserDefaultCurrency(settlement.fromUserId);
      balancesMap.set(settlement.fromUserId, { paid: 0, owed: 0, currency: userCurrency, settlementsPaid: 0, settlementsReceived: 0 });
    }
    const fromBalance = balancesMap.get(settlement.fromUserId)!;
    fromBalance.settlementsPaid += settlement.normalizedFromAmount;

    // toUserId received, add normalizedToAmount
    if (!balancesMap.has(settlement.toUserId)) {
      const userCurrency = await getUserDefaultCurrency(settlement.toUserId);
      balancesMap.set(settlement.toUserId, { paid: 0, owed: 0, currency: userCurrency, settlementsPaid: 0, settlementsReceived: 0 });
    }
    const toBalance = balancesMap.get(settlement.toUserId)!;
    toBalance.settlementsReceived += settlement.normalizedToAmount;
  }

  // Convert to Balance array
  const balances: Balance[] = [];
  for (const [userId, balance] of balancesMap.entries()) {
    balances.push({
      userId,
      netAmount: balance.paid - balance.owed + balance.settlementsReceived - balance.settlementsPaid,
      currency: balance.currency,
    });
  }

  return balances;
}

/**
 * Get balances for a direct thread (2 users)
 */
export async function getBalancesForDirect(directId: string, _viewerCurrency: string): Promise<Balance[]> {
  const expenses = await listExpensesForDirect(directId);
  const balancesMap = new Map<string, { paid: number; owed: number; currency: string; settlementsPaid: number; settlementsReceived: number }>();

  // Process all expenses
  for (const expense of expenses) {
    // Get payers
    const payersSnapshot = await getDocs(collection(db, 'expenses', expense.id, 'payers'));
    for (const payerDoc of payersSnapshot.docs) {
      const payerData = payerDoc.data();
      if (!payerData.userId) continue;

      const userCurrency = await getUserDefaultCurrency(payerData.userId);
      const normalizedPaid = normalizeAmount(payerData.amount, expense.currency as Currency, userCurrency as Currency);

      if (!balancesMap.has(payerData.userId)) {
        balancesMap.set(payerData.userId, { paid: 0, owed: 0, currency: userCurrency, settlementsPaid: 0, settlementsReceived: 0 });
      }
      const balance = balancesMap.get(payerData.userId)!;
      balance.paid += normalizedPaid.convertedAmount;
    }

    // Get splits
    const splitsSnapshot = await getDocs(collection(db, 'expenses', expense.id, 'splits'));
    for (const splitDoc of splitsSnapshot.docs) {
      const splitData = splitDoc.data();
      if (!splitData.userId) continue;

      if (!balancesMap.has(splitData.userId)) {
        balancesMap.set(splitData.userId, { paid: 0, owed: 0, currency: splitData.normalizedCurrency, settlementsPaid: 0, settlementsReceived: 0 });
      }
      const balance = balancesMap.get(splitData.userId)!;
      balance.owed += splitData.normalizedAmount;
    }
  }

  // Process settlements (only COMPLETED status)
  const { listSettlementsForDirect } = await import('./settlementService');
  const settlements = await listSettlementsForDirect(directId);
  for (const settlement of settlements) {
    if (settlement.status !== 'COMPLETED') continue;

    // fromUserId paid, subtract normalizedFromAmount
    if (!balancesMap.has(settlement.fromUserId)) {
      const userCurrency = await getUserDefaultCurrency(settlement.fromUserId);
      balancesMap.set(settlement.fromUserId, { paid: 0, owed: 0, currency: userCurrency, settlementsPaid: 0, settlementsReceived: 0 });
    }
    const fromBalance = balancesMap.get(settlement.fromUserId)!;
    fromBalance.settlementsPaid += settlement.normalizedFromAmount;

    // toUserId received, add normalizedToAmount
    if (!balancesMap.has(settlement.toUserId)) {
      const userCurrency = await getUserDefaultCurrency(settlement.toUserId);
      balancesMap.set(settlement.toUserId, { paid: 0, owed: 0, currency: userCurrency, settlementsPaid: 0, settlementsReceived: 0 });
    }
    const toBalance = balancesMap.get(settlement.toUserId)!;
    toBalance.settlementsReceived += settlement.normalizedToAmount;
  }

  // Convert to Balance array
  const balances: Balance[] = [];
  for (const [userId, balance] of balancesMap.entries()) {
    balances.push({
      userId,
      netAmount: balance.paid - balance.owed + balance.settlementsReceived - balance.settlementsPaid,
      currency: balance.currency,
    });
  }

  return balances;
}
