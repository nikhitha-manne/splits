import { useState } from 'react';
import { type BillItem, type ItemAssignment } from '../../../services/billService';
import { type ContainerType } from '../types';

interface AssignmentModalProps {
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

export function AssignmentModal({
  item,
  participants,
  currency,
  assignments: initialAssignments,
  onSave,
  onClose,
  currentUserId,
  containerType,
  directOtherUserName,
}: AssignmentModalProps) {
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
