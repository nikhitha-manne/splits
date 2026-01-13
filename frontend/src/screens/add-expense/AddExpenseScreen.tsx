import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { listGroupMembers } from '../../services/groupService';
import { findOrCreateDirectThread } from '../../services/directService';
import { createExpense, type CreateExpenseInput } from '../../services/expenseService';
import { type SplitParticipant } from '../../services/splitCalculator';
import { isValidCurrency } from '../../services/currencyService';
import {
  createBillUpload,
  uploadBillImage,
  addOrUpdateItem,
  listItems,
  deleteItem,
  setItemAssignments as saveItemAssignments,
  getItemAssignments,
  type BillItem,
  type ItemAssignment,
} from '../../services/billService';
import { useAddExpenseState } from './hooks/useAddExpenseState';
import { useAddExpenseQueryParams } from './hooks/useAddExpenseQueryParams';
import { useItemBasedTotals } from './itemBased/useItemBasedTotals';
import { ItemBasedSection } from './itemBased/ItemBasedSection';
import { ContainerStep } from './components/ContainerStep';
import { BasicsStep } from './components/BasicsStep';
import { ParticipantsPayersStep } from './components/ParticipantsPayersStep';
import { SplitReviewStep } from './components/SplitReviewStep';

export function AddExpenseScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Use centralized state hook
  const state = useAddExpenseState();

  // Destructure state for easier access
  const {
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
    loadingMembers,
    setLoadingMembers,
    title,
    setTitle,
    description,
    setDescription,
    amount,
    setAmount,
    currency,
    setCurrency,
    payers,
    setPayers,
    splitType,
    setSplitType,
    splitInputs,
    setSplitInputs,
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
    currentStep,
    setCurrentStep,
    error,
    setError,
    submitting,
    setSubmitting,
  } = state;

  // Use item-based totals hook
  useItemBasedTotals({
    billUploadId,
    billItems,
    itemAssignments,
    splitType,
    setItemTotals,
  });

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

  // Initialize from query params
  useAddExpenseQueryParams({
    setContainerType,
    setSelectedGroupId,
    setSelectedDirectId,
    setCurrency,
    setAvailableGroups,
    setDirectOtherUser,
    loadGroupMembers,
  });

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
      // Recompute totals after assignment change (useItemBasedTotals hook will handle this)
      setSelectedItemForAssignment(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save assignments');
    }
  };

  const handleSaveItem = async (item: { id: string; name: string; price: number; orderIndex: number }) => {
    if (item.id) {
      await handleUpdateItem(item as BillItem);
    } else {
      await handleAddItem({ name: item.name, price: item.price });
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
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Add Expense</h1>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex-1 h-1 rounded ${
                  step <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
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
          <ContainerStep
            containerType={containerType}
            setContainerType={setContainerType}
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
            selectedDirectId={selectedDirectId}
            directOtherUser={directOtherUser}
            setDirectOtherUser={setDirectOtherUser}
            userSearchEmail={userSearchEmail}
            setUserSearchEmail={setUserSearchEmail}
            searchingUser={searchingUser}
            setSearchingUser={setSearchingUser}
            availableGroups={availableGroups}
            groupMembers={groupMembers}
            setGroupMembers={setGroupMembers}
            selectedParticipants={selectedParticipants}
            setSelectedParticipants={setSelectedParticipants}
            loadingMembers={loadingMembers}
            setLoadingMembers={setLoadingMembers}
            setError={setError}
            loadGroupMembers={loadGroupMembers}
          />
        )}

        {/* Step 2: Basics */}
        {currentStep === 2 && (
          <BasicsStep
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            amount={amount}
            setAmount={setAmount}
            currency={currency}
            setCurrency={setCurrency}
          />
        )}

        {/* Step 3: Paid By + Participants */}
        {currentStep === 3 && (
          <ParticipantsPayersStep
            containerType={containerType}
            directOtherUser={directOtherUser}
            selectedParticipants={selectedParticipants}
            amount={amount}
            currency={currency}
            payers={payers}
            setPayers={setPayers}
            formatCurrency={formatCurrency}
          />
        )}

        {/* Step 4: Split + Review */}
        {currentStep === 4 && (
          <>
            {splitType === 'ITEM_BASED' ? (
              <ItemBasedSection
                billUploadId={billUploadId}
                billImageUrl={billImageUrl}
                uploadingImage={uploadingImage}
                billItems={billItems}
                itemAssignments={itemAssignments}
                currency={currency}
                currentUserId={user.uid}
                containerType={containerType}
                directOtherUserName={directOtherUser?.name}
                participants={participants}
                onBillImageUpload={handleBillImageUpload}
                onRemoveBillImage={() => setBillImageUrl(null)}
                onAddItem={() => setEditingItem({ id: '', name: '', price: 0, orderIndex: billItems.length })}
                onEditItem={setEditingItem}
                onDeleteItem={handleDeleteItem}
                onAssignItem={setSelectedItemForAssignment}
                onSaveItemAssignments={handleSaveItemAssignments}
                onSaveItem={handleSaveItem}
                editingItem={editingItem}
                selectedItemForAssignment={selectedItemForAssignment}
                onCloseEditModal={() => setEditingItem(null)}
                onCloseAssignmentModal={() => setSelectedItemForAssignment(null)}
              />
            ) : (
              <SplitReviewStep
                containerType={containerType}
                directOtherUser={directOtherUser}
                selectedParticipants={selectedParticipants}
                amount={amount}
                currency={currency}
                splitType={splitType}
                setSplitType={setSplitType}
                splitInputs={splitInputs}
                setSplitInputs={setSplitInputs}
                payers={payers}
                title={title}
                formatCurrency={formatCurrency}
                onSplitTypeChange={(newSplitType) => {
                  // Reset bill upload state if switching away from ITEM_BASED
                  if (newSplitType !== 'ITEM_BASED') {
                    setBillUploadId(null);
                    setBillImageUrl(null);
                    setBillItems([]);
                    setItemAssignments({});
                  }
                }}
              />
            )}
          </>
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
    </div>
  );
}
