import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getGroup, getUserRoleInGroup, createInviteLink, createInviteEmail, type Group, type GroupMemberRole } from '../services/groupService';
import { listSettlementsForGroup, reverseSettlement, type Settlement } from '../services/settlementService';
import { SettlementForm } from '../components/SettlementForm';
import { sendInviteEmail } from '../services/inviteEmailService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export function GroupDetailScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [userRole, setUserRole] = useState<GroupMemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'settle'>('expenses');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!groupId || !user) return;

    loadGroup();
  }, [groupId, user]);

  useEffect(() => {
    if (activeTab === 'settle' && groupId) {
      loadSettlements();
    }
  }, [activeTab, groupId]);

  const loadGroup = async () => {
    if (!groupId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const [groupData, role] = await Promise.all([
        getGroup(groupId),
        getUserRoleInGroup(groupId, user.uid),
      ]);

      if (!groupData) {
        setError('Group not found');
        return;
      }

      if (!role) {
        setError('You are not a member of this group');
        return;
      }

      setGroup(groupData);
      setUserRole(role);
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(err?.message || 'Missing or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLinkInvite = async () => {
    if (!groupId || !user) return;

    setInviteError(null);
    setInviteSubmitting(true);

    try {
      const { token } = await createInviteLink(groupId, user.uid);
      const inviteUrl = `${window.location.origin}/invite/${token}`;
      setInviteLink(inviteUrl);
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setInviteError(err?.message || 'Missing or insufficient permissions.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCreateEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !user || !inviteEmail.trim() || !group) return;

    setInviteError(null);
    setEmailSendFailed(false);
    setGeneratedInviteLink(null);
    setInviteSubmitting(true);

    try {
      // Create invite in Firestore
      const { token } = await createInviteEmail(groupId, inviteEmail, user.uid);
      
      // Build invite link
      const appBaseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
      const inviteLink = `${appBaseUrl}/invite/${token}`;
      setGeneratedInviteLink(inviteLink);

      // Send email via serverless endpoint
      const inviterName = user.name || 'Someone';
      const groupName = group.name;
      
      const emailResult = await sendInviteEmail({
        toEmail: inviteEmail.trim(),
        inviteLink,
        inviterName,
        groupName,
        type: 'group',
      });

      if (emailResult.ok) {
        // Success - clear form and close modal
        setInviteEmail('');
        setInviteLink(null);
        setGeneratedInviteLink(null);
        setShowInviteModal(false);
        alert('Invite email sent successfully');
      } else {
        // Email sending failed - show fallback UI
        setEmailSendFailed(true);
        setInviteError(`Couldn't send email: ${emailResult.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setInviteError(err?.message || 'Failed to create invite');
      // If invite was created but email failed, show fallback
      if (generatedInviteLink) {
        setEmailSendFailed(true);
      }
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard');
    }
  };

  const loadSettlements = async () => {
    if (!groupId) return;

    setSettlementsLoading(true);
    try {
      const settlementsData = await listSettlementsForGroup(groupId);
      setSettlements(settlementsData);

      // Load user names for all unique user IDs
      const userIds = new Set<string>();
      settlementsData.forEach((s) => {
        userIds.add(s.fromUserId);
        userIds.add(s.toUserId);
      });

      const names: Record<string, string> = {};
      for (const userId of userIds) {
        try {
          const userDoc = await getDoc(doc(db, 'publicUsers', userId));
          if (userDoc.exists()) {
            names[userId] = userDoc.data().name;
          } else {
            names[userId] = `User ${userId.slice(0, 8)}...`;
          }
        } catch (err) {
          names[userId] = `User ${userId.slice(0, 8)}...`;
        }
      }
      setUserNames(names);
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      console.error('Failed to load settlements:', err);
    } finally {
      setSettlementsLoading(false);
    }
  };

  const handleReverseSettlement = async (settlementId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to reverse this settlement?')) {
      return;
    }

    try {
      await reverseSettlement(settlementId, user.uid);
      loadSettlements();
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      alert(err?.message || 'Missing or insufficient permissions.');
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

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const canReverseSettlement = (settlement: Settlement): boolean => {
    if (!user || settlement.status !== 'COMPLETED') return false;
    // Can reverse if: creator OR admin OR (direct: either member)
    if (settlement.createdBy === user.uid) return true;
    if (userRole === 'admin') return true;
    // For direct, either member can reverse (handled by service)
    return false;
  };

  const isAdmin = userRole === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading group...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="bg-white border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600 mb-4">{error || 'Group not found'}</p>
          <button
            onClick={() => navigate('/groups')}
            className="text-blue-600 underline text-sm"
          >
            Back to Groups
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#F8F9FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/groups')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowInviteModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Invite
              </button>
              <button
                onClick={() => {/* Settings placeholder */}}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Settings
              </button>
            </div>
          )}
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{group.name}</h1>
        {group.description && (
          <p className="text-sm text-gray-600 mt-1">{group.description}</p>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-4">Invite to Group</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Email Invite
                </label>
                <form onSubmit={handleCreateEmailInvite} className="flex gap-2">
                  <input
                    type="email"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                  <button
                    type="submit"
                    disabled={inviteSubmitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Link Invite
                </label>
                {inviteLink ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteLink}
                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateLinkInvite}
                    disabled={inviteSubmitting}
                    className="w-full bg-gray-600 text-white py-2 rounded text-sm font-medium disabled:opacity-60"
                  >
                    {inviteSubmitting ? 'Creating...' : 'Generate Link'}
                  </button>
                )}
              </div>

              {inviteError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {inviteError}
                </div>
              )}

              {/* Fallback UI when email sending fails */}
              {emailSendFailed && generatedInviteLink && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800 mb-2">
                    Couldn&apos;t send email. Copy the invite link instead:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className="flex-1 border border-yellow-300 rounded px-3 py-2 text-sm bg-white"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInviteLink);
                        alert('Invite link copied to clipboard');
                      }}
                      className="bg-yellow-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-yellow-700"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteLink(null);
                setInviteError(null);
                setEmailSendFailed(false);
                setGeneratedInviteLink(null);
              }}
              className="mt-4 w-full border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'expenses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'balances'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Balances
          </button>
          <button
            onClick={() => setActiveTab('settle')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'settle'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Settle Up
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 py-4">
        {activeTab === 'settle' && (
          <div className="space-y-4">
            <button
              onClick={() => setShowSettlementForm(true)}
              className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700"
            >
              Record Payment
            </button>

            {settlementsLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Loading settlements...</div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No settlements yet</div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Settlement History</h3>
                {settlements.map((settlement) => (
                  <div
                    key={settlement.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">
                            {settlement.fromUserId === user?.uid ? 'You' : userNames[settlement.fromUserId] || 'User'}
                          </span>{' '}
                          paid{' '}
                          <span className="font-medium">
                            {settlement.toUserId === user?.uid ? 'you' : userNames[settlement.toUserId] || 'User'}
                          </span>
                        </p>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {formatCurrency(settlement.amount, settlement.currency)}
                        </p>
                      </div>
                      {settlement.status === 'REVERSED' && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Reversed</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDate(settlement.createdAt)}</span>
                      {canReverseSettlement(settlement) && (
                        <button
                          onClick={() => handleReverseSettlement(settlement.id)}
                          className="text-red-600 hover:text-red-700 underline"
                        >
                          Reverse
                        </button>
                      )}
                    </div>
                    {settlement.note && (
                      <p className="text-xs text-gray-600 mt-1 italic">{settlement.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'expenses' && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Expenses will appear here</p>
          </div>
        )}
        {activeTab === 'balances' && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Balances will appear here</p>
          </div>
        )}
      </div>

      {/* Settlement Form Modal */}
      {showSettlementForm && groupId && (
        <SettlementForm
          containerType="group"
          groupId={groupId}
          onClose={() => setShowSettlementForm(false)}
          onSuccess={() => {
            loadSettlements();
          }}
        />
      )}
    </div>
  );
}
