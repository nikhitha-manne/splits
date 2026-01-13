import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getDirectThread } from '../services/directService';
import { listExpensesForDirect, getBalancesForDirect, type Expense, type Balance } from '../services/expenseService';
import { listSettlementsForDirect, reverseSettlement, type Settlement } from '../services/settlementService';
import { SettlementForm } from '../components/SettlementForm';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Card } from '../ui/components/Card';
import { BalanceText } from '../ui/components/BalanceText';
import { Button } from '../ui/components/Button';
import { theme } from '../ui/theme';

export function DirectDetailScreen() {
  const { directId } = useParams<{ directId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [thread, setThread] = useState<any>(null);
  const [otherUserName, setOtherUserName] = useState('');
  const [otherUserEmail, setOtherUserEmail] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [otherUserId, setOtherUserId] = useState<string>('');

  useEffect(() => {
    if (!directId || !user) return;
    loadThreadData();
  }, [directId, user]);

  const loadThreadData = async () => {
    if (!directId || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch thread
      const threadData = await getDirectThread(directId);
      if (!threadData) {
        setError('Direct thread not found');
        return;
      }

      // Verify user is a member
      if (!threadData.memberIds.includes(user.uid)) {
        setError('You are not a member of this thread');
        return;
      }

      setThread(threadData);

      // Find other user
      const otherId = threadData.memberIds.find((id) => id !== user.uid) || threadData.memberIds[0];
      setOtherUserId(otherId);

      // Fetch other user's data
      try {
        const otherUserDoc = await getDoc(doc(db, 'publicUsers', otherId));
        if (otherUserDoc.exists()) {
          const otherUserData = otherUserDoc.data();
          setOtherUserName(otherUserData.name);
          setOtherUserEmail(otherUserData.email || '');
        }
      } catch (err) {
        console.error('Error fetching other user:', err);
      }

      // Fetch expenses, balance, and settlements
      const [expensesData, balances, settlementsData] = await Promise.all([
        listExpensesForDirect(directId),
        getBalancesForDirect(directId, user.defaultCurrency),
        listSettlementsForDirect(directId),
      ]);

      setExpenses(expensesData);
      const userBalance = balances.find((b) => b.userId === user.uid) || null;
      setBalance(userBalance);
      setSettlements(settlementsData);
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(err?.message || 'Missing or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleReverseSettlement = async (settlementId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to reverse this settlement?')) {
      return;
    }

    try {
      await reverseSettlement(settlementId, user.uid);
      loadThreadData(); // Reload to refresh settlements
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      alert(err?.message || 'Missing or insufficient permissions.');
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const handleAddExpense = () => {
    navigate(`/add-expense?mode=direct&directId=${directId}`);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}
      >
        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
          Loading thread...
        </p>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="min-h-screen px-4 py-6" style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}>
        <div className="p-4 text-center border-2 rounded-lg" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.negative, boxShadow: theme.shadow.card }}>
          <p className="mb-4" style={{ color: theme.colors.negative }}>
            {error || 'Thread not found'}
          </p>
          <Button variant="ghost" onClick={() => navigate('/direct')}>
            Back to Direct Threads
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}>
      {/* Header */}
      <div
        className="border-b px-4 py-4"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/direct')}
            className="text-sm"
            style={{ color: theme.colors.textSecondary }}
          >
            ← Back
          </button>
          <button
            onClick={handleAddExpense}
            className="text-sm"
            style={{ color: '#2563eb' }}
          >
            Add Expense
          </button>
        </div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: theme.colors.textPrimary }}>
          {otherUserName}
        </h1>
        <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
          {otherUserEmail}
        </p>
        {balance && (
          <div className="mb-3">
            <BalanceText amount={balance.netAmount} currency={user?.defaultCurrency || 'USD'} />
          </div>
        )}
        <Button onClick={() => setShowSettlementForm(true)} className="w-full">
          Settle Up
        </Button>
      </div>

      {/* Settlement History */}
      {settlements.length > 0 && (
        <div className="px-4 py-4 border-b" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: theme.colors.textPrimary }}>
            Settlement History
          </h2>
          <div className="space-y-2">
            {settlements.map((settlement) => (
              <Card key={settlement.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: theme.colors.textPrimary }}>
                      <span className="font-medium">
                        {settlement.fromUserId === user?.uid ? 'You' : otherUserName || 'User'}
                      </span>{' '}
                      paid{' '}
                      <span className="font-medium">
                        {settlement.toUserId === user?.uid ? 'you' : otherUserName || 'User'}
                      </span>
                    </p>
                    <p className="text-sm font-medium mt-1" style={{ color: theme.colors.textPrimary }}>
                      {formatCurrency(settlement.amount, settlement.currency)}
                    </p>
                  </div>
                  {settlement.status === 'REVERSED' && (
                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#f3f4f6', color: theme.colors.textSecondary }}>
                      Reversed
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs mt-2" style={{ color: theme.colors.textSecondary }}>
                  <span>{formatDate(settlement.createdAt)}</span>
                  {settlement.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleReverseSettlement(settlement.id)}
                      className="underline"
                      style={{ color: theme.colors.negative }}
                    >
                      Reverse
                    </button>
                  )}
                </div>
                {settlement.note && (
                  <p className="text-xs mt-2 italic" style={{ color: theme.colors.textSecondary }}>
                    {settlement.note}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="px-4 py-6" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {expenses.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="mb-4" style={{ color: theme.colors.textSecondary }}>
              No expenses yet
            </p>
            <Button onClick={handleAddExpense}>Add Expense</Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <Card key={expense.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium" style={{ color: theme.colors.textPrimary }}>
                        {expense.title}
                      </h2>
                      {expense.editedFlag && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#f3f4f6', color: theme.colors.textSecondary }}>
                          Edited
                        </span>
                      )}
                    </div>
                    {expense.description && (
                      <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                        {expense.description}
                      </p>
                    )}
                    <p className="text-xs mt-2" style={{ color: theme.colors.textSecondary }}>
                      {formatDate(expense.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium" style={{ color: theme.colors.textPrimary }}>
                      {formatCurrency(expense.totalAmount, expense.currency)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Settlement Form Modal */}
      {showSettlementForm && directId && otherUserId && (
        <SettlementForm
          containerType="direct"
          directId={directId}
          directOtherUserId={otherUserId}
          directOtherUserName={otherUserName}
          onClose={() => setShowSettlementForm(false)}
          onSuccess={() => {
            loadThreadData();
          }}
        />
      )}
    </div>
  );
}
