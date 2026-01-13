import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { acceptInviteByToken } from '../services/groupService';

export function AcceptInviteScreen() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      // Redirect to login if not authenticated
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const handleAcceptInvite = async () => {
    if (!token || !user) return;

    setAccepting(true);
    setError(null);

    try {
      const { groupId, groupName: name } = await acceptInviteByToken(token, user.uid);
      setGroupName(name);
      setSuccess(true);

      // Redirect to group after 2 seconds
      setTimeout(() => {
        navigate(`/groups/${groupId}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-green-200 rounded-lg p-6 max-w-sm w-full text-center">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <h2 className="text-xl font-semibold mb-2">Invite Accepted!</h2>
          <p className="text-gray-600 mb-4">
            You've been added to <strong>{groupName}</strong>
          </p>
          <p className="text-sm text-gray-500">Redirecting to group...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-xl font-semibold mb-4 text-center">Accept Group Invite</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        <p className="text-gray-600 mb-6 text-center">
          Click the button below to join this group.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleAcceptInvite}
            disabled={accepting}
            className="w-full bg-blue-600 text-white py-3 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            {accepting ? 'Accepting...' : 'Accept Invite'}
          </button>

          <button
            onClick={() => navigate('/groups')}
            className="w-full border border-gray-300 text-gray-700 py-3 rounded text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
