import { useAuth } from '../../../auth/AuthContext';
import { calculateSplit, type SplitType, type SplitParticipant } from '../../../services/splitCalculator';
import { type Currency, normalizeAmount } from '../../../services/currencyService';
import { type ContainerType, type UserInfo, type Payer } from '../types';

interface SplitReviewStepProps {
  containerType: ContainerType;
  directOtherUser: UserInfo | null;
  selectedParticipants: string[];
  amount: string;
  currency: Currency;
  splitType: SplitType;
  setSplitType: (type: SplitType) => void;
  splitInputs: Record<string, number>;
  setSplitInputs: (inputs: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  payers: Payer[];
  title: string;
  formatCurrency: (amount: number, currencyCode: string) => string;
  onSplitTypeChange?: (type: SplitType) => void;
  validateNonItemSplit?: () => boolean;
}

export function SplitReviewStep({
  containerType,
  directOtherUser,
  selectedParticipants,
  amount,
  currency,
  splitType,
  setSplitType,
  splitInputs,
  setSplitInputs,
  payers,
  title,
  formatCurrency,
  onSplitTypeChange,
}: SplitReviewStepProps) {
  const { user } = useAuth();

  const participants = containerType === 'direct'
    ? [user!.uid, directOtherUser?.uid].filter(Boolean) as string[]
    : selectedParticipants;

  const getSplitPreview = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return [];

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

  const handleSplitTypeChange = (newSplitType: SplitType) => {
    setSplitType(newSplitType);
    if (onSplitTypeChange) {
      onSplitTypeChange(newSplitType);
    }
  };

  const splitPreview = getSplitPreview();

  return (
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
            handleSplitTypeChange(newSplitType);
          }}
        >
          <option value="EQUAL">Equal</option>
          <option value="EXACT">Exact amounts</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="SHARES">Shares</option>
          <option value="ITEM_BASED">Item-based (Bill Upload)</option>
        </select>
      </div>

      {splitType !== 'EQUAL' && splitType !== 'ITEM_BASED' && (
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            {splitType === 'EXACT' ? 'Exact Amounts' : splitType === 'PERCENTAGE' ? 'Percentages' : 'Shares'}
          </label>
          <div className="space-y-2">
            {participants.map((userId) => (
              <div key={userId} className="flex items-center gap-2">
                <span className="text-sm text-gray-700 w-24 truncate">
                  {userId === user?.uid ? 'You' : 'User'}
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
            {splitPreview.map((split) => {
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
                <span>{payer.userId === user?.uid ? 'You' : 'User'}</span>
                <span>{formatCurrency(payer.amount, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
