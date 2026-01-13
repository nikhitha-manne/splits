import { useAuth } from '../../../auth/AuthContext';
import { type ContainerType, type UserInfo, type Payer } from '../types';
import { type Currency } from '../../../services/currencyService';

interface ParticipantsPayersStepProps {
  containerType: ContainerType;
  directOtherUser: UserInfo | null;
  selectedParticipants: string[];
  amount: string;
  currency: Currency;
  payers: Payer[];
  setPayers: (payers: Payer[] | ((prev: Payer[]) => Payer[])) => void;
  formatCurrency: (amount: number, currencyCode: string) => string;
}

export function ParticipantsPayersStep({
  containerType,
  directOtherUser,
  selectedParticipants,
  amount,
  currency,
  payers,
  setPayers,
  formatCurrency,
}: ParticipantsPayersStepProps) {
  const { user } = useAuth();

  const participants = containerType === 'direct'
    ? [user!.uid, directOtherUser?.uid].filter(Boolean) as string[]
    : selectedParticipants;

  const amountNum = parseFloat(amount);

  return (
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
  );
}
