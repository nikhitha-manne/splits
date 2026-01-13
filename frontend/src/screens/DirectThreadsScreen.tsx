import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listDirectThreadsForUser, type DirectThread } from '../services/directService';
import { getBalancesForDirect, type Balance } from '../services/expenseService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Card } from '../ui/components/Card';
import { BalanceText } from '../ui/components/BalanceText';
import { Button } from '../ui/components/Button';
import { theme } from '../ui/theme';

interface DirectThreadWithUser {
  thread: DirectThread;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  balance: Balance | null;
}

export function DirectThreadsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<DirectThreadWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadThreads();
  }, [user]);

  const loadThreads = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all direct threads for user
      const directThreads = await listDirectThreadsForUser(user.uid);

      // For each thread, fetch other user data and balance
      const threadsWithUserData: DirectThreadWithUser[] = await Promise.all(
        directThreads.map(async (thread) => {
          // Find the other user (not current user)
          const otherUserId = thread.memberIds.find((id) => id !== user.uid) || thread.memberIds[0];

          // Fetch other user's data
          let otherUserName = 'Unknown User';
          let otherUserEmail = '';

          try {
            const otherUserDoc = await getDoc(doc(db, 'publicUsers', otherUserId));
            if (otherUserDoc.exists()) {
              const otherUserData = otherUserDoc.data();
              otherUserName = otherUserData.name;
              otherUserEmail = otherUserData.email || '';
            }
          } catch (err) {
            console.error('Error fetching other user:', err);
          }

          // Fetch balance for this thread
          let balance: Balance | null = null;
          try {
            const balances = await getBalancesForDirect(thread.id, user.defaultCurrency);
            balance = balances.find((b) => b.userId === user.uid) || null;
          } catch (err) {
            console.error('Error fetching balance:', err);
          }

          return {
            thread,
            otherUserId,
            otherUserName,
            otherUserEmail,
            balance,
          };
        })
      );

      setThreads(threadsWithUserData);
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(err?.message || 'Missing or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleThreadClick = (threadId: string) => {
    navigate(`/direct/${threadId}`);
  };

  const handleAddExpense = () => {
    navigate('/add-expense?mode=direct');
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}
      >
        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
          Loading direct threads...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}>
      <div
        className="border-b px-4 py-3 sticky top-0 z-10"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
      >
        <h1 className="text-xl font-semibold" style={{ color: theme.colors.textPrimary }}>
          Direct
        </h1>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 border rounded text-sm" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: theme.colors.negative }}>
          {error}
        </div>
      )}

      <div className="px-4 py-6" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {threads.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="mb-4" style={{ color: theme.colors.textSecondary }}>
              No direct expenses yet
            </p>
            <Button onClick={handleAddExpense}>Add Direct Expense</Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {threads.map((threadData) => (
              <Card
                key={threadData.thread.id}
                onClick={() => handleThreadClick(threadData.thread.id)}
                className="p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="font-medium" style={{ color: theme.colors.textPrimary }}>
                      {threadData.otherUserName}
                    </h2>
                    <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                      {threadData.otherUserEmail}
                    </p>
                    {threadData.balance && (
                      <div className="mt-2">
                        <BalanceText
                          amount={threadData.balance.netAmount}
                          currency={user?.defaultCurrency || 'USD'}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
