import { useState } from 'react';
import { type ContainerType, type UserInfo } from '../types';
import { type Currency } from '../../../services/currencyService';
import { type SplitType } from '../../../services/splitCalculator';
import { type BillItem, type ItemAssignment } from '../../../services/billService';
import { type Group, type GroupMember } from '../../../services/groupService';

/**
 * Central state management hook for AddExpenseScreen
 * This is just state - no behavior/logic
 */
export function useAddExpenseState() {
  // Step 1: Container
  const [containerType, setContainerType] = useState<ContainerType>('group');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedDirectId, setSelectedDirectId] = useState<string>('');
  const [directOtherUser, setDirectOtherUser] = useState<UserInfo | null>(null);
  const [userSearchEmail, setUserSearchEmail] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<(Group & { role: string })[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Step 2: Basics
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');

  // Step 3: Paid By
  const [payers, setPayers] = useState<Array<{ userId: string; amount: number }>>([]);

  // Step 4: Split
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [splitInputs, setSplitInputs] = useState<Record<string, number>>({});

  // ITEM_BASED state
  const [billUploadId, setBillUploadId] = useState<string | null>(null);
  const [billImageUrl, setBillImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [editingItem, setEditingItem] = useState<BillItem | null>(null);
  const [selectedItemForAssignment, setSelectedItemForAssignment] = useState<BillItem | null>(null);
  const [itemAssignments, setItemAssignments] = useState<Record<string, ItemAssignment[]>>({});
  const [itemTotals, setItemTotals] = useState<Map<string, number>>(new Map());

  // UI State
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return {
    // Container state
    containerType,
    setContainerType,
    selectedGroupId,
    setSelectedGroupId,
    selectedDirectId,
    setSelectedDirectId,
    directOtherUser,
    setDirectOtherUser,
    userSearchEmail,
    setUserSearchEmail,
    searchingUser,
    setSearchingUser,
    availableGroups,
    setAvailableGroups,
    groupMembers,
    setGroupMembers,
    selectedParticipants,
    setSelectedParticipants,
    loadingGroups,
    setLoadingGroups,
    loadingMembers,
    setLoadingMembers,

    // Basics state
    title,
    setTitle,
    description,
    setDescription,
    amount,
    setAmount,
    currency,
    setCurrency,

    // Payers state
    payers,
    setPayers,

    // Split state
    splitType,
    setSplitType,
    splitInputs,
    setSplitInputs,

    // ITEM_BASED state
    billUploadId,
    setBillUploadId,
    billImageUrl,
    setBillImageUrl,
    uploadingImage,
    setUploadingImage,
    billItems,
    setBillItems,
    editingItem,
    setEditingItem,
    selectedItemForAssignment,
    setSelectedItemForAssignment,
    itemAssignments,
    setItemAssignments,
    itemTotals,
    setItemTotals,

    // UI state
    currentStep,
    setCurrentStep,
    error,
    setError,
    submitting,
    setSubmitting,
  };
}
