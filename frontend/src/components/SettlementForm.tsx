import { type FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createSettlement, type ContainerType, type CreateSettlementInput } from '../services/settlementService';
import { listGroupMembers, type GroupMember } from '../services/groupService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { type Currency, isValidCurrency } from '../services/currencyService';

interface SettlementFormProps {
  containerType: ContainerType;
  groupId?: string;
  directId?: string;
  directOtherUserId?: string;
  directOtherUserName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SettlementForm({
  containerType,
  groupId,
  directId,
  directOtherUserId,
  directOtherUserName,
  onClose,
  onSuccess,
}: SettlementFormProps) {
  const { user } = useAuth();
  const [fromUserId, setFromUserId] = useState<string>(user?.uid || '');
  const [toUserId, setToUserId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>((user?.defaultCurrency as Currency) || 'USD');
  const [note, setNote] = useState('');
  const [groupMembers, setGroupMembers] = useState<(GroupMember & { name: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Default fromUser to current user
    setFromUserId(user.uid);

    // Load group members if group
    if (containerType === 'group' && groupId) {
      loadGroupMembers();
    } else if (containerType === 'direct' && directOtherUserId) {
      // Default toUser to other user for direct
      setToUserId(directOtherUserId);
    }
  }, [user, containerType, groupId, directOtherUserId]);

  const loadGroupMembers = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      const members = await listGroupMembers(groupId);
      const membersWithNames = await Promise.all(
        members.map(async (member) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', member.userId));
            const userData = userDoc.data();
            return {
              ...member,
              name: userData?.name || `User ${member.userId.slice(0, 8)}...`,
            };
          } catch (err) {
            return {
              ...member,
              name: `User ${member.userId.slice(0, 8)}...`,
            };
          }
        })
      );
      setGroupMembers(membersWithNames);
    } catch (err) {
      console.error('Failed to load group members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be logged in');
      return;
    }

    if (!fromUserId || !toUserId) {
      setError('Please select both from and to users');
      return;
    }

    if (fromUserId === toUserId) {
      setError('Cannot create settlement between the same user');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (!isValidCurrency(currency)) {
      setError('Invalid currency');
      return;
    }

    setLoading(true);

    try {
      const settlementInput: CreateSettlementInput = {
        containerType,
        groupId: containerType === 'group' ? groupId : undefined,
        directId: containerType === 'direct' ? directId : undefined,
        fromUserId,
        toUserId,
        amount: amountNum,
        currency,
        createdBy: user.uid,
        note: note.trim() || undefined,
      };

      await createSettlement(settlementInput);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create settlement');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Paid By <span className="text-red-500">*</span>
            </label>
            {containerType === 'direct' ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                {fromUserId === user.uid ? 'You' : directOtherUserName || 'Other User'}
              </div>
            ) : (
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                disabled={loading}
                required
              >
                <option value="">Select user</option>
                {groupMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.userId === user.uid ? 'You' : member.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Paid To <span className="text-red-500">*</span>
            </label>
            {containerType === 'direct' ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                {toUserId === user.uid ? 'You' : directOtherUserName || 'Other User'}
              </div>
            ) : (
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                disabled={loading}
                required
              >
                <option value="">Select user</option>
                {groupMembers
                  .filter((member) => member.userId !== fromUserId)
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.userId === user.uid ? 'You' : member.name}
                    </option>
                  ))}
              </select>
            )}
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
              disabled={loading}
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
              disabled={loading}
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Note (optional)</label>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
