import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listUserGroups, listGroupMembers, type Group, type GroupMember } from '../services/groupService';
import { findOrCreateDirectThread, getDirectThread } from '../services/directService';
import { createExpense, getUserByEmail, type CreateExpenseInput } from '../services/expenseService';
import { calculateSplit, type SplitType, type SplitParticipant } from '../services/splitCalculator';
import { type Currency, isValidCurrency, normalizeAmount } from '../services/currencyService';
import {
  createBillUpload,
  uploadBillImage,
  addOrUpdateItem,
  listItems,
  deleteItem,
  setItemAssignments as saveItemAssignments,
  getItemAssignments,
  computeTotals,
  type BillItem,
  type ItemAssignment,
} from '../services/billService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

type ContainerType = 'group' | 'direct';

interface UserInfo {
  uid: string;
  name: string;
  email: string;
  defaultCurrency: string;
}

export function AddExpenseScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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

  // Initialize from query params
  useEffect(() => {
    if (!user) return;

    const mode = searchParams.get('mode');
    const directIdParam = searchParams.get('directId');
    const groupIdParam = searchParams.get('groupId');

    if (mode === 'direct' || directIdParam) {
      setContainerType('direct');
      if (directIdParam) {
        setSelectedDirectId(directIdParam);
        loadDirectThread(directIdParam);
      }
    } else if (mode === 'group' || groupIdParam) {
      setContainerType('group');
      if (groupIdParam) {
        setSelectedGroupId(groupIdParam);
        loadGroupMembers(groupIdParam);
      }
    }

    setCurrency((user.defaultCurrency as Currency) || 'USD');
    loadUserGroups();
  }, [user, searchParams]);

  const loadUserGroups = async () => {
    if (!user) return;

    setLoadingGroups(true);
    try {
      const groups = await listUserGroups(user.uid);
      setAvailableGroups(groups);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    if (!user) return;

    setLoadingMembers(true);
    try {
      const members = await listGroupMembers(groupId);
      setGroupMembers(members);
      // Default to all members selected
      setSelectedParticipants(members.map((m) => m.userId));
    } catch (err) {
      console.error('Failed to load group members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadDirectThread = async (directId: string) => {
    if (!user) return;

    try {
      const thread = await getDirectThread(directId);
      if (thread) {
        const otherUserId = thread.memberIds.find((id) => id !== user.uid) || thread.memberIds[0];
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        if (otherUserDoc.exists()) {
          const otherUserData = otherUserDoc.data();
          setDirectOtherUser({
            uid: otherUserDoc.id,
            name: otherUserData.name,
            email: otherUserData.email,
            defaultCurrency: otherUserData.defaultCurrency || 'USD',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load direct thread:', err);
    }
  };

  const handleSearchUser = async () => {
    if (!userSearchEmail.trim()) return;

    setSearchingUser(true);
    setError(null);

    try {
      const foundUser = await getUserByEmail(userSearchEmail.trim());
      if (!foundUser) {
        setError('User not found');
        return;
      }

      if (foundUser.uid === user?.uid) {
        setError('Cannot create expense with yourself');
        return;
      }

      setDirectOtherUser(foundUser);
      setUserSearchEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to search user');
    } finally {
      setSearchingUser(false);
    }
  };

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
    loadGroupMembers(groupId);
  };

  const handleParticipantToggle = (userId: string) => {
    if (containerType === 'direct') return; // Direct is fixed to 2 users

    setSelectedParticipants((prev) => {
      if (prev.includes(userId)) {
        const newList = prev.filter((id) => id !== userId);
        // Ensure at least 2 participants
        if (newList.length < 2) {
          setError('At least 2 participants required');
          return prev;
        }
        return newList;
      } else {
        return [...prev, userId];
      }
    });
  };

  // Initialize payers when amount or participants change
  useEffect(() => {
    if (!user || currentStep < 3) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    if (payers.length === 0) {
      // Default: current user pays full amount
      setPayers([{ userId: user.uid, amount: amountNum }]);
    }
  }, [amount, user, currentStep]);

  // Initialize split inputs when split type or participants change
  useEffect(() => {
    if (!user || currentStep < 4) return;

    // Skip initialization for ITEM_BASED (handled separately)
    if (splitType === 'ITEM_BASED') return;

    const inputs: Record<string, number> = {};
    const participants = containerType === 'direct'
      ? [user.uid, directOtherUser?.uid].filter(Boolean) as string[]
      : selectedParticipants;

    if (splitType === 'PERCENTAGE') {
      // Default equal percentages
      const percentage = 100 / participants.length;
      participants.forEach((userId) => {
        inputs[userId] = percentage;
      });
    } else if (splitType === 'SHARES') {
      // Default equal shares
      participants.forEach((userId) => {
        inputs[userId] = 1;
      });
    } else if (splitType === 'EXACT') {
      // Default equal amounts
      const amountNum = parseFloat(amount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const perPerson = amountNum / participants.length;
        participants.forEach((userId) => {
          inputs[userId] = perPerson;
        });
      }
    }

    setSplitInputs(inputs);
  }, [splitType, selectedParticipants, directOtherUser, containerType, amount, user, currentStep]);

  // Load bill items when ITEM_BASED is selected and billUploadId exists
  useEffect(() => {
    if (splitType === 'ITEM_BASED' && billUploadId) {
      loadBillItems();
    }
  }, [splitType, billUploadId]);

  // Compute item totals when items or assignments change
  useEffect(() => {
    if (splitType === 'ITEM_BASED' && billItems.length > 0 && billUploadId) {
      computeItemTotals();
    }
  }, [billItems, itemAssignments, splitType, billUploadId]);

  const validateStep1 = (): boolean => {
    if (containerType === 'direct') {
      if (!directOtherUser) {
        setError('Please select another user for direct expense');
        return false;
      }
    } else {
      if (!selectedGroupId) {
        setError('Please select a group');
        return false;
      }
      if (selectedParticipants.length < 2) {
        setError('At least 2 participants required');
        return false;
      }
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!title.trim()) {
      setError('Title is required');
      return false;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number');
      return false;
    }
    if (!isValidCurrency(currency)) {
      setError('Invalid currency');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const amountNum = parseFloat(amount);
    const payersSum = payers.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(payersSum - amountNum) > 0.01) {
      setError(`Payers sum (${payersSum.toFixed(2)}) does not equal expense amount (${amountNum.toFixed(2)})`);
      return false;
    }
    return true;
  };

  const validateStep4 = (): boolean => {
    const amountNum = parseFloat(amount);
    const participants = containerType === 'direct'
      ? [user!.uid, directOtherUser!.uid]
      : selectedParticipants;

    if (splitType === 'ITEM_BASED') {
      // Validate bill upload exists
      if (!billUploadId) {
        setError('Please upload bill image first');
        return false;
      }

      // Validate items exist
      if (billItems.length === 0) {
        setError('Please add at least one item');
        return false;
      }

      // Validate all items are fully assigned
      for (const item of billItems) {
        const assignments = itemAssignments[item.id] || [];
        const sum = assignments.reduce((s, a) => s + a.share, 0);
        if (Math.abs(sum - item.price) > 0.01) {
          setError(`Item "${item.name}" is not fully assigned. Sum: ${sum.toFixed(2)}, Price: ${item.price.toFixed(2)}`);
          return false;
        }
      }

      // Validate total items match expense amount (with tolerance)
      const itemsTotal = billItems.reduce((sum, item) => sum + item.price, 0);
      if (Math.abs(itemsTotal - amountNum) > 0.01) {
        setError(`Items total (${itemsTotal.toFixed(2)}) does not match expense amount (${amountNum.toFixed(2)})`);
        return false;
      }
    } else if (splitType === 'EXACT') {
      const sum = participants.reduce((sum, userId) => sum + (splitInputs[userId] || 0), 0);
      if (Math.abs(sum - amountNum) > 0.01) {
        setError(`Exact amounts sum to ${sum.toFixed(2)}, but expense total is ${amountNum.toFixed(2)}`);
        return false;
      }
    } else if (splitType === 'PERCENTAGE') {
      const sum = participants.reduce((sum, userId) => sum + (splitInputs[userId] || 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        setError(`Percentages sum to ${sum.toFixed(2)}%, but must equal 100%`);
        return false;
      }
    } else if (splitType === 'SHARES') {
      const hasZero = participants.some((userId) => !splitInputs[userId] || splitInputs[userId] <= 0);
      if (hasZero) {
        setError('All shares must be greater than 0');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    let isValid = false;

    if (currentStep === 1) isValid = validateStep1();
    else if (currentStep === 2) isValid = validateStep2();
    else if (currentStep === 3) isValid = validateStep3();
    else if (currentStep === 4) isValid = validateStep4();

    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    setError(null);
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!user) return;

    setError(null);
    if (!validateStep4()) return;

    setSubmitting(true);

    try {
      const amountNum = parseFloat(amount);
      const participants = containerType === 'direct'
        ? [user.uid, directOtherUser!.uid]
        : selectedParticipants;

      // Build split participants
      let splitParticipants: SplitParticipant[];
      if (splitType === 'ITEM_BASED') {
        // For ITEM_BASED, compute from item totals
        const totals = Array.from(itemTotals.entries());
        splitParticipants = totals.map(([userId, total]) => ({
          userId,
          value: total, // Use computed total as exact amount
        }));
      } else {
        splitParticipants = participants.map((userId) => ({
          userId,
          value: splitType !== 'EQUAL' ? splitInputs[userId] : undefined,
        }));
      }

      let finalDirectId = selectedDirectId;

      // Create/find direct thread if needed
      if (containerType === 'direct' && !finalDirectId && directOtherUser) {
        const thread = await findOrCreateDirectThread(user.uid, directOtherUser.uid);
        finalDirectId = thread.id;
      }

      // Create expense
      const expenseInput: CreateExpenseInput = {
        containerType,
        groupId: containerType === 'group' ? selectedGroupId : undefined,
        directId: containerType === 'direct' ? finalDirectId : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        amount: amountNum,
        currency,
        splitType,
        participants: splitParticipants,
        payers,
        createdBy: user.uid,
      };

      await createExpense(expenseInput);

      // Navigate
      if (containerType === 'group') {
        navigate(`/groups/${selectedGroupId}`);
      } else {
        navigate(`/direct/${finalDirectId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currencyCode: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Bill upload and item functions
  const handleBillImageUpload = async (file: File) => {
    if (!user) return;

    setUploadingImage(true);
    setError(null);

    try {
      // Create bill upload if not exists
      let uploadId = billUploadId;
      if (!uploadId) {
        const participants = containerType === 'direct'
          ? [user.uid, directOtherUser?.uid].filter(Boolean) as string[]
          : selectedParticipants;

        if (participants.length < 2) {
          setError('Please select participants first');
          return;
        }

        uploadId = await createBillUpload({
          containerType,
          groupId: containerType === 'group' ? selectedGroupId : undefined,
          directId: containerType === 'direct' ? selectedDirectId : undefined,
          createdBy: user.uid,
          currency,
        });
        setBillUploadId(uploadId);
      }

      // Upload image
      const imageUrl = await uploadBillImage(file, uploadId);
      setBillImageUrl(imageUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload bill image');
    } finally {
      setUploadingImage(false);
    }
  };

  const loadBillItems = async () => {
    if (!billUploadId) return;

    try {
      const items = await listItems(billUploadId);
      setBillItems(items);

      // Load assignments for all items
      const assignmentsMap: Record<string, ItemAssignment[]> = {};
      for (const item of items) {
        const assignments = await getItemAssignments(billUploadId, item.id);
        assignmentsMap[item.id] = assignments;
      }
      setItemAssignments(assignmentsMap);
      // Compute totals after loading items and assignments
      await computeItemTotals();
    } catch (err) {
      console.error('Failed to load bill items:', err);
    }
  };

  const handleAddItem = async (item: { name: string; price: number }) => {
    if (!billUploadId) {
      setError('Please upload bill image first');
      return;
    }

    try {
      const orderIndex = billItems.length;
      await addOrUpdateItem(billUploadId, {
        name: item.name,
        price: item.price,
        orderIndex,
      });
      await loadBillItems();
      setEditingItem(null);
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    }
  };

  const handleUpdateItem = async (item: BillItem) => {
    if (!billUploadId) return;

    try {
      await addOrUpdateItem(billUploadId, item);
      await loadBillItems();
      setEditingItem(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!billUploadId) return;

    try {
      await deleteItem(billUploadId, itemId);
      await loadBillItems();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    }
  };

  const handleSaveItemAssignments = async (itemId: string, assignments: ItemAssignment[]) => {
    if (!billUploadId) return;

    try {
      // Validate sum equals item price
      const item = billItems.find((i) => i.id === itemId);
      if (!item) return;

      const sum = assignments.reduce((s, a) => s + a.share, 0);
      if (Math.abs(sum - item.price) > 0.01) {
        setError(`Assignments sum to ${sum.toFixed(2)}, but item price is ${item.price.toFixed(2)}`);
        return;
      }

      await saveItemAssignments(billUploadId, itemId, assignments);
      const updatedAssignments = await getItemAssignments(billUploadId, itemId);
      setItemAssignments((prev) => {
        const newAssignments = { ...prev };
        newAssignments[itemId] = updatedAssignments;
        return newAssignments;
      });
      setSelectedItemForAssignment(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save assignments');
    }
  };

  const computeItemTotals = async () => {
    if (!billUploadId) return;

    try {
      const totals = await computeTotals(billUploadId);
      setItemTotals(totals);
    } catch (err) {
      console.error('Failed to compute totals:', err);
    }
  };

  // Get split preview
  const getSplitPreview = () => {
    if (!user || currentStep < 4) return [];

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return [];

    if (splitType === 'ITEM_BASED') {
      // For ITEM_BASED, return from computed totals
      const results: Array<{ userId: string; amount: number }> = [];
      itemTotals.forEach((total, userId) => {
        results.push({ userId, amount: total });
      });
      return results;
    }

    const participants = containerType === 'direct'
      ? [user.uid, directOtherUser?.uid].filter(Boolean) as string[]
      : selectedParticipants;

    const splitParticipants: SplitParticipant[] = participants.map((userId) => ({
      userId,
      value: splitType !== 'EQUAL' ? splitInputs[userId] : undefined,
    }));

    try {
      return calculateSplit(amountNum, splitType, splitParticipants);
    } catch (err) {
      return [];
    }
  };


  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <p className="text-sm text-gray-600">Please log in</p>
      </div>
    );
  }

  const participants = containerType === 'direct'
    ? [user.uid, directOtherUser?.uid].filter(Boolean) as string[]
    : selectedParticipants;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Add Expense</h1>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full ${
                  step === currentStep
                    ? 'bg-blue-600'
                    : step < currentStep
                    ? 'bg-blue-300'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="px-4 py-4">
        {/* Step 1: Container */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Expense Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedDirectId) {
                      setContainerType('group');
                      setDirectOtherUser(null);
                    }
                  }}
                  disabled={!!selectedDirectId}
                  className={`flex-1 py-2 rounded text-sm font-medium ${
                    containerType === 'group'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  } disabled:opacity-50`}
                >
                  Group
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedGroupId) {
                      setContainerType('direct');
                    }
                  }}
                  disabled={!!selectedGroupId}
                  className={`flex-1 py-2 rounded text-sm font-medium ${
                    containerType === 'direct'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  } disabled:opacity-50`}
                >
                  Direct
                </button>
              </div>
            </div>

            {containerType === 'direct' ? (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Other User <span className="text-red-500">*</span>
                </label>
                {selectedDirectId ? (
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="font-medium text-gray-900">{directOtherUser?.name || 'User'}</p>
                    <p className="text-sm text-gray-600">{directOtherUser?.email}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Search by email"
                        value={userSearchEmail}
                        onChange={(e) => setUserSearchEmail(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchUser();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSearchUser}
                        disabled={searchingUser || !userSearchEmail.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-60"
                      >
                        {searchingUser ? '...' : 'Search'}
                      </button>
                    </div>
                    {directOtherUser && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <p className="font-medium text-gray-900">{directOtherUser.name}</p>
                        <p className="text-sm text-gray-600">{directOtherUser.email}</p>
                        <button
                          type="button"
                          onClick={() => setDirectOtherUser(null)}
                          className="text-xs text-red-600 mt-2"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={selectedGroupId}
                    onChange={(e) => handleGroupSelect(e.target.value)}
                    disabled={loadingGroups || !!searchParams.get('groupId')}
                  >
                    <option value="">Select group</option>
                    {availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                {loadingMembers ? (
                  <p className="text-sm text-gray-600">Loading members...</p>
                ) : selectedGroupId && groupMembers.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Participants <span className="text-red-500">*</span> (minimum 2)
                    </label>
                    <div className="space-y-2">
                      {groupMembers.map((member) => (
                        <label
                          key={member.userId}
                          className="flex items-center p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedParticipants.includes(member.userId)}
                            onChange={() => handleParticipantToggle(member.userId)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-900">User {member.userId.slice(0, 8)}...</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Basics */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Dinner at restaurant"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Description (optional)</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 3: Paid By + Participants */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Participants
              </label>
              {containerType === 'direct' ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-sm text-gray-700">
                    You and {directOtherUser?.name || 'Other User'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">(Direct expenses are always between 2 people)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedParticipants.map((userId) => (
                    <div key={userId} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                      {userId === user?.uid ? 'You' : `User ${userId.slice(0, 8)}...`}
                    </div>
                  ))}
                  {selectedParticipants.length < 2 && (
                    <p className="text-xs text-red-600">At least 2 participants required</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Paid By <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {payers.map((payer, index) => {
                  const amountNum = parseFloat(amount);
                  const remaining = amountNum - payers.reduce((sum, p, i) => (i === index ? sum : sum + p.amount), 0);

                  return (
                    <div key={`${payer.userId}-${index}`} className="flex gap-2 items-center">
                      <div className="w-20 text-sm text-gray-700">
                        {payer.userId === user?.uid ? 'You' : containerType === 'direct' ? directOtherUser?.name || 'User' : 'User'}
                      </div>
                      <div className="flex-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={remaining}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={payer.amount}
                          onChange={(e) => {
                            const newAmount = parseFloat(e.target.value) || 0;
                            setPayers((prev) =>
                              prev.map((p, i) => (i === index ? { ...p, amount: newAmount } : p))
                            );
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (payers.length > 1) {
                            setPayers((prev) => prev.filter((_, i) => i !== index));
                          }
                        }}
                        className="text-red-600 text-sm px-2"
                        disabled={payers.length === 1}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {payers.reduce((sum, p) => sum + p.amount, 0) < parseFloat(amount || '0') && (
                  <button
                    type="button"
                    onClick={() => {
                      const amountNum = parseFloat(amount);
                      const remaining = amountNum - payers.reduce((sum, p) => sum + p.amount, 0);
                      const nextParticipant = participants.find((userId) => !payers.find((p) => p.userId === userId));
                      if (nextParticipant) {
                        setPayers([...payers, { userId: nextParticipant, amount: remaining }]);
                      }
                    }}
                    className="text-blue-600 text-sm underline"
                  >
                    + Add payer
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total: {formatCurrency(payers.reduce((sum, p) => sum + p.amount, 0), currency)} /{' '}
                {formatCurrency(parseFloat(amount) || 0, currency)}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Split + Review */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Split Type <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={splitType}
                onChange={(e) => {
                  const newSplitType = e.target.value as SplitType;
                  setSplitType(newSplitType);
                  // Reset bill upload state if switching away from ITEM_BASED
                  if (newSplitType !== 'ITEM_BASED') {
                    setBillUploadId(null);
                    setBillImageUrl(null);
                    setBillItems([]);
                    setItemAssignments({});
                  }
                }}
              >
                <option value="EQUAL">Equal</option>
                <option value="EXACT">Exact amounts</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="SHARES">Shares</option>
                <option value="ITEM_BASED">Item-based (Bill Upload)</option>
              </select>
            </div>

            {splitType === 'ITEM_BASED' && (
              <div className="space-y-4">
                {/* Bill Upload Section */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Bill Photo <span className="text-red-500">*</span>
                  </label>
                  {billImageUrl ? (
                    <div className="space-y-2">
                      <img
                        src={billImageUrl}
                        alt="Bill"
                        className="w-full max-h-64 object-contain border border-gray-200 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBillImageUrl(null);
                        }}
                        className="text-sm text-red-600 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleBillImageUpload(file);
                          }
                        }}
                        className="hidden"
                        id="bill-upload"
                        disabled={uploadingImage}
                      />
                      <label
                        htmlFor="bill-upload"
                        className={`block w-full border-2 border-dashed border-gray-300 rounded px-4 py-8 text-center cursor-pointer hover:border-blue-500 ${
                          uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {uploadingImage ? (
                          <span className="text-sm text-gray-600">Uploading...</span>
                        ) : (
                          <span className="text-sm text-gray-600">Click to upload bill photo</span>
                        )}
                      </label>
                    </div>
                  )}
                </div>

                {/* Items List Section */}
                {billUploadId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Items</label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem({ id: '', name: '', price: 0, orderIndex: billItems.length });
                        }}
                        className="text-sm text-blue-600 underline"
                      >
                        + Add Item
                      </button>
                    </div>

                    {billItems.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center">No items yet. Add items manually.</p>
                    ) : (
                      <div className="space-y-2">
                        {billItems.map((item) => {
                          const assignments = itemAssignments[item.id] || [];
                          const assignedSum = assignments.reduce((sum, a) => sum + a.share, 0);
                          const isFullyAssigned = Math.abs(assignedSum - item.price) < 0.01;

                          return (
                            <div
                              key={item.id}
                              className="bg-white border border-gray-200 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex-1">
                                  <p className="font-medium text-sm text-gray-900">{item.name}</p>
                                  <p className="text-sm text-gray-600">
                                    {formatCurrency(item.price, currency)}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedItemForAssignment(item)}
                                    className={`text-xs px-2 py-1 rounded ${
                                      isFullyAssigned
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                    }`}
                                  >
                                    {isFullyAssigned ? 'Assigned' : 'Assign'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingItem(item)}
                                    className="text-xs text-blue-600 underline"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="text-xs text-red-600 underline"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {!isFullyAssigned && (
                                <p className="text-xs text-red-600 mt-1">
                                  Not fully assigned: {formatCurrency(assignedSum, currency)} /{' '}
                                  {formatCurrency(item.price, currency)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {splitType !== 'EQUAL' && splitType !== 'ITEM_BASED' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  {splitType === 'EXACT' ? 'Exact Amounts' : splitType === 'PERCENTAGE' ? 'Percentages' : 'Shares'}
                </label>
                <div className="space-y-2">
                  {participants.map((userId) => (
                    <div key={userId} className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 w-24 truncate">
                        {userId === user.uid ? 'You' : 'User'}
                      </span>
                      <input
                        type="number"
                        step={splitType === 'PERCENTAGE' ? '0.01' : '0.01'}
                        min={splitType === 'SHARES' ? '0.01' : '0'}
                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={splitInputs[userId] || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setSplitInputs((prev) => ({ ...prev, [userId]: value }));
                        }}
                        placeholder={splitType === 'PERCENTAGE' ? '0.00%' : splitType === 'SHARES' ? '1' : '0.00'}
                      />
                      {splitType === 'PERCENTAGE' && <span className="text-sm text-gray-600">%</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review Panel */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Review</h3>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600">Expense: {title || '(no title)'}</p>
                  <p className="text-gray-600">
                    Amount: {formatCurrency(parseFloat(amount) || 0, currency)}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="font-medium text-gray-900 mb-2">Split Preview:</p>
                  {getSplitPreview().map((split) => {
                    // For normalized amounts, we can only show for current user and direct other user
                    // For group participants, normalization happens on save
                    const canShowNormalized = split.userId === user?.uid || (containerType === 'direct' && split.userId === directOtherUser?.uid);
                    const userCurrency = split.userId === user?.uid 
                      ? (user.defaultCurrency as Currency)
                      : (containerType === 'direct' ? (directOtherUser?.defaultCurrency as Currency) || 'USD' : 'USD');
                    const normalized = canShowNormalized ? normalizeAmount(split.amount, currency, userCurrency) : null;
                    
                    return (
                      <div key={split.userId} className="space-y-1 mb-2 pb-2 border-b border-gray-200 last:border-0">
                        <div className="flex justify-between text-gray-700">
                          <span>{split.userId === user?.uid ? 'You' : containerType === 'direct' ? directOtherUser?.name || 'User' : 'User'}</span>
                          <span className="font-medium">{formatCurrency(split.amount, currency)}</span>
                        </div>
                        {normalized && (
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Normalized to {userCurrency}:</span>
                            <span>{formatCurrency(normalized.convertedAmount, userCurrency)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <p className="font-medium text-gray-900 mb-2">Paid By:</p>
                  {payers.map((payer) => (
                    <div key={payer.userId} className="flex justify-between text-gray-700">
                      <span>{payer.userId === user.uid ? 'You' : 'User'}</span>
                      <span>{formatCurrency(payer.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-6">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50"
            >
              Previous
            </button>
          )}
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-blue-700"
            >
              {submitting ? 'Creating...' : 'Create Expense'}
            </button>
          )}
        </div>
      </div>

      {/* Item Edit Modal */}
      {editingItem !== null && (
        <ItemEditModal
          item={editingItem}
          currency={currency}
          onSave={async (item) => {
            if (item.id) {
              await handleUpdateItem(item);
            } else {
              await handleAddItem({ name: item.name, price: item.price });
            }
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Item Assignment Modal */}
      {selectedItemForAssignment && (
        <ItemAssignmentModal
          item={selectedItemForAssignment}
          participants={participants}
          currency={currency}
          assignments={itemAssignments[selectedItemForAssignment.id] || []}
          onSave={async (assignments) => {
            await handleSaveItemAssignments(selectedItemForAssignment.id, assignments);
          }}
          onClose={() => setSelectedItemForAssignment(null)}
          currentUserId={user.uid}
          containerType={containerType}
          directOtherUserName={directOtherUser?.name}
        />
      )}
    </div>
  );
}

// Item Edit Modal Component
interface ItemEditModalProps {
  item: BillItem;
  currency?: string;
  onSave: (item: { id: string; name: string; price: number; orderIndex: number }) => void;
  onClose: () => void;
}

function ItemEditModal({ item, onSave, onClose }: ItemEditModalProps) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price.toString());
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    onSave({
      id: item.id,
      name: name.trim(),
      price: priceNum,
      orderIndex: item.orderIndex,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-semibold mb-4">{item.id ? 'Edit Item' : 'Add Item'}</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Item Name</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pizza"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Price</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Item Assignment Modal Component
interface ItemAssignmentModalProps {
  item: BillItem;
  participants: string[];
  currency: string;
  assignments: ItemAssignment[];
  onSave: (assignments: ItemAssignment[]) => void;
  onClose: () => void;
  currentUserId: string;
  containerType: ContainerType;
  directOtherUserName?: string;
}

function ItemAssignmentModal({
  item,
  participants,
  currency,
  assignments: initialAssignments,
  onSave,
  onClose,
  currentUserId,
  containerType,
  directOtherUserName,
}: ItemAssignmentModalProps) {
  const [assignments, setAssignments] = useState<ItemAssignment[]>(
    initialAssignments.length > 0
      ? initialAssignments
      : participants.map((userId) => ({ userId, share: 0 }))
  );
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number, currencyCode: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const totalAssigned = assignments.reduce((sum, a) => sum + a.share, 0);
  const remaining = item.price - totalAssigned;

  const handleAssignTo = (userId: string) => {
    setAssignments(
      assignments.map((a) => (a.userId === userId ? { ...a, share: item.price } : { ...a, share: 0 }))
    );
  };

  const handleSplitEqually = () => {
    const selectedParticipants = participants;
    const perPerson = item.price / selectedParticipants.length;
    const rounded = Math.floor(perPerson * 100) / 100;
    const remainder = item.price - rounded * selectedParticipants.length;

    setAssignments(
      assignments.map((a, index) => ({
        ...a,
        share: selectedParticipants.includes(a.userId)
          ? rounded + (index < remainder * 100 ? 0.01 : 0)
          : 0,
      }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Filter out zero assignments
    const nonZeroAssignments = assignments.filter((a) => a.share > 0);

    if (nonZeroAssignments.length === 0) {
      setError('At least one participant must be assigned');
      return;
    }

    const sum = nonZeroAssignments.reduce((s, a) => s + a.share, 0);
    if (Math.abs(sum - item.price) > 0.01) {
      // Auto-correct rounding errors
      const difference = item.price - sum;
      if (nonZeroAssignments.length > 0) {
        nonZeroAssignments[0].share += difference;
      }
    }

    onSave(nonZeroAssignments);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-2">Assign: {item.name}</h2>
        <p className="text-sm text-gray-600 mb-4">Price: {formatCurrency(item.price, currency)}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={handleSplitEqually}
            className="flex-1 text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200"
          >
            Split Equally
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {participants.map((userId) => {
            const assignment = assignments.find((a) => a.userId === userId) || { userId, share: 0 };
            return (
              <div key={userId} className="flex items-center gap-2">
                <span className="text-sm text-gray-700 w-24 truncate">
                  {userId === currentUserId
                    ? 'You'
                    : containerType === 'direct'
                    ? directOtherUserName || 'User'
                    : 'User'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={item.price}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={assignment.share}
                  onChange={(e) => {
                    const newShare = parseFloat(e.target.value) || 0;
                    setAssignments(
                      assignments.map((a) => (a.userId === userId ? { ...a, share: newShare } : a))
                    );
                  }}
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={() => handleAssignTo(userId)}
                  className="text-xs text-blue-600 underline"
                >
                  Full
                </button>
              </div>
            );
          })}

          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Total Assigned:</span>
              <span className={Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(totalAssigned, currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Remaining:</span>
              <span className={Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(remaining, currency)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
