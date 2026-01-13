import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listDirectThreadsForUser, type DirectThread } from '../services/directService';
import { getBalancesForDirect, getBalancesForGroup, type Balance } from '../services/expenseService';
import { listUserGroups, type Group } from '../services/groupService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Card } from '../ui/components/Card';
import { SectionHeader } from '../ui/components/SectionHeader';
import { BalanceText } from '../ui/components/BalanceText';
import { Button } from '../ui/components/Button';
import { theme } from '../ui/theme';

interface DirectThreadWithUser {
  thread: DirectThread;
  otherUserName: string;
  otherUserEmail: string;
  balance: Balance | null;
}

interface GroupWithBalance {
  group: Group & { role: string };
  balance: Balance | null;
}

export function HomeScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directThreads, setDirectThreads] = useState<DirectThreadWithUser[]>([]);
  const [groups, setGroups] = useState<GroupWithBalance[]>([]);
  const [totalOwed, setTotalOwed] = useState(0); // Negative amounts (you owe)
  const [totalOwedToYou, setTotalOwedToYou] = useState(0); // Positive amounts (you are owed)

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Load direct threads and groups in parallel
      const [directThreadsData, groupsData] = await Promise.all([
        listDirectThreadsForUser(user.uid),
        listUserGroups(user.uid),
      ]);

      // Load direct threads with user data and balances
      const threadsWithData: DirectThreadWithUser[] = await Promise.all(
        directThreadsData.map(async (thread) => {
          const otherUserId = thread.memberIds.find((id) => id !== user.uid) || thread.memberIds[0];

          // Fetch other user's data and balance in parallel
          const [otherUserDoc, balances] = await Promise.all([
            getDoc(doc(db, 'publicUsers', otherUserId)).catch(() => null),
            getBalancesForDirect(thread.id, user.defaultCurrency).catch(() => []),
          ]);

          const otherUserName = otherUserDoc?.exists() ? otherUserDoc.data().name : 'Unknown User';
          const otherUserEmail = otherUserDoc?.exists() ? otherUserDoc.data().email || '' : '';
          const balance = balances.find((b) => b.userId === user.uid) || null;

          return {
            thread,
            otherUserName,
            otherUserEmail,
            balance,
          };
        })
      );

      // Load groups with balances
      const groupsWithBalances: GroupWithBalance[] = await Promise.all(
        groupsData.map(async (group) => {
          try {
            const balances = await getBalancesForGroup(group.id, user.defaultCurrency);
            const balance = balances.find((b) => b.userId === user.uid) || null;
            return { group, balance };
          } catch (err) {
            console.error(`Failed to load balance for group ${group.id}:`, err);
            return { group, balance: null };
          }
        })
      );

      setDirectThreads(threadsWithData);
      setGroups(groupsWithBalances);

      // Calculate totals
      // Note: For now, we sum balances directly. Each balance is in its user's default currency.
      // Future enhancement: convert all balances to current user's currency for accurate totals.
      let totalOwedSum = 0;
      let totalOwedToYouSum = 0;

      // Sum direct thread balances
      for (const threadData of threadsWithData) {
        if (threadData.balance) {
          const balanceAmount = threadData.balance.netAmount;
          if (balanceAmount < 0) {
            totalOwedSum += Math.abs(balanceAmount);
          } else if (balanceAmount > 0) {
            totalOwedToYouSum += balanceAmount;
          }
        }
      }

      // Sum group balances
      for (const groupData of groupsWithBalances) {
        if (groupData.balance) {
          const balanceAmount = groupData.balance.netAmount;
          if (balanceAmount < 0) {
            totalOwedSum += Math.abs(balanceAmount);
          } else if (balanceAmount > 0) {
            totalOwedToYouSum += balanceAmount;
          }
        }
      }

      setTotalOwed(totalOwedSum);
      setTotalOwedToYou(totalOwedToYouSum);
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

  const handleDirectThreadClick = (directId: string) => {
    navigate(`/direct/${directId}`);
  };

  const handleAddDirectExpense = () => {
    navigate('/add-expense?mode=direct');
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/groups/${groupId}`);
  };

  const handleCreateGroup = () => {
    navigate('/groups/create');
  };

  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}
      >
        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
          Please log in
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}
      >
        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
          Loading...
        </p>
      </div>
    );
  }

  const userCurrency = user.defaultCurrency || 'USD';
  const netAmount = totalOwedToYou - totalOwed;

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}>
      <div
        className="border-b px-4 py-3 sticky top-0 z-10"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
      >
        <h1 className="text-xl font-semibold" style={{ color: theme.colors.textPrimary }}>
          Home
        </h1>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 border rounded text-sm" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: theme.colors.negative }}>
          {error}
        </div>
      )}

      <div className="px-4 py-6 space-y-6" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Summary Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: theme.colors.textPrimary }}>
            Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                You owe
              </span>
              <span className="text-sm font-medium" style={{ color: theme.colors.negative }}>
                {formatCurrency(totalOwed, userCurrency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                You are owed
              </span>
              <span className="text-sm font-medium" style={{ color: theme.colors.positive }}>
                {formatCurrency(totalOwedToYou, userCurrency)}
              </span>
            </div>
            <div className="pt-3 border-t" style={{ borderColor: theme.colors.border }}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium" style={{ color: theme.colors.textPrimary }}>
                  Net
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color:
                      netAmount > 0
                        ? theme.colors.positive
                        : netAmount < 0
                        ? theme.colors.negative
                        : theme.colors.textSecondary,
                  }}
                >
                  {formatCurrency(Math.abs(netAmount), userCurrency)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* People Section */}
        <div>
          <SectionHeader>People</SectionHeader>
          {directThreads.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="mb-4" style={{ color: theme.colors.textSecondary }}>
                No direct expenses yet
              </p>
              <Button onClick={handleAddDirectExpense}>Add Direct Expense</Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {directThreads.map((threadData) => (
                <Card
                  key={threadData.thread.id}
                  onClick={() => handleDirectThreadClick(threadData.thread.id)}
                  className="p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium" style={{ color: theme.colors.textPrimary }}>
                        {threadData.otherUserName}
                      </h4>
                      <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                        {threadData.otherUserEmail}
                      </p>
                      {threadData.balance && (
                        <div className="mt-2">
                          <BalanceText
                            amount={threadData.balance.netAmount}
                            currency={userCurrency}
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

        {/* Groups Section */}
        <div>
          <SectionHeader>Groups</SectionHeader>
          {groups.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="mb-4" style={{ color: theme.colors.textSecondary }}>
                No groups yet
              </p>
              <Button onClick={handleCreateGroup}>Create Group</Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {groups.map((groupData) => (
                <Card
                  key={groupData.group.id}
                  onClick={() => handleGroupClick(groupData.group.id)}
                  className="p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium" style={{ color: theme.colors.textPrimary }}>
                        {groupData.group.name}
                      </h4>
                      {groupData.group.description && (
                        <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                          {groupData.group.description}
                        </p>
                      )}
                      {groupData.balance && (
                        <div className="mt-2">
                          <BalanceText
                            amount={groupData.balance.netAmount}
                            currency={userCurrency}
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
    </div>
  );
}
