import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { type Group, type GroupMember } from '../../../services/groupService';
import { getUserByEmail } from '../../../services/expenseService';
import { type ContainerType, type UserInfo } from '../types';

interface ContainerStepProps {
  containerType: ContainerType;
  setContainerType: (type: ContainerType) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  selectedDirectId: string;
  directOtherUser: UserInfo | null;
  setDirectOtherUser: (user: UserInfo | null) => void;
  userSearchEmail: string;
  setUserSearchEmail: (email: string) => void;
  searchingUser: boolean;
  setSearchingUser: (searching: boolean) => void;
  availableGroups: (Group & { role: string })[];
  groupMembers: GroupMember[];
  setGroupMembers: (members: GroupMember[]) => void;
  selectedParticipants: string[];
  setSelectedParticipants: (participants: string[] | ((prev: string[]) => string[])) => void;
  loadingMembers: boolean;
  setLoadingMembers: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadGroupMembers: (groupId: string) => Promise<void>;
}

export function ContainerStep({
  containerType,
  setContainerType,
  selectedGroupId,
  setSelectedGroupId,
  selectedDirectId,
  directOtherUser,
  setDirectOtherUser,
  userSearchEmail,
  setUserSearchEmail,
  searchingUser,
  setSearchingUser,
  availableGroups,
  groupMembers,
  selectedParticipants,
  setSelectedParticipants,
  loadingMembers,
  setError,
  loadGroupMembers,
}: ContainerStepProps) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const handleSearchUser = async () => {
    if (!userSearchEmail.trim()) return;

    setSearchingUser(true);
    setError(null);

    try {
      const foundUser = await getUserByEmail(userSearchEmail.trim());
      if (!foundUser) {
        setError('User not found');
        return;
      }

      if (foundUser.uid === user?.uid) {
        setError('Cannot create expense with yourself');
        return;
      }

      setDirectOtherUser(foundUser);
      setUserSearchEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to search user');
    } finally {
      setSearchingUser(false);
    }
  };

  const handleGroupSelect = async (groupId: string) => {
    setSelectedGroupId(groupId);
    await loadGroupMembers(groupId);
  };

  const handleParticipantToggle = (userId: string) => {
    if (containerType === 'direct') return; // Direct is fixed to 2 users

    setSelectedParticipants((prev: string[]) => {
      if (prev.includes(userId)) {
        const newList = prev.filter((id: string) => id !== userId);
        // Ensure at least 2 participants
        if (newList.length < 2) {
          setError('At least 2 participants required');
          return prev;
        }
        return newList;
      } else {
        return [...prev, userId];
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">Expense Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!selectedDirectId) {
                setContainerType('group');
                setDirectOtherUser(null);
              }
            }}
            disabled={!!selectedDirectId}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              containerType === 'group'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            } disabled:opacity-50`}
          >
            Group
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedGroupId) {
                setContainerType('direct');
              }
            }}
            disabled={!!selectedGroupId}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              containerType === 'direct'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            } disabled:opacity-50`}
          >
            Direct
          </button>
        </div>
      </div>

      {containerType === 'direct' ? (
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Other User <span className="text-red-500">*</span>
          </label>
          {selectedDirectId ? (
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="font-medium text-gray-900">{directOtherUser?.name || 'User'}</p>
              <p className="text-sm text-gray-600">{directOtherUser?.email}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search by email"
                  value={userSearchEmail}
                  onChange={(e) => setUserSearchEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchUser();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearchUser}
                  disabled={searchingUser || !userSearchEmail.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-60"
                >
                  {searchingUser ? '...' : 'Search'}
                </button>
              </div>
              {directOtherUser && (
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="font-medium text-gray-900">{directOtherUser.name}</p>
                  <p className="text-sm text-gray-600">{directOtherUser.email}</p>
                  <button
                    type="button"
                    onClick={() => setDirectOtherUser(null)}
                    className="text-xs text-red-600 mt-2"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Group <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedGroupId}
              onChange={(e) => handleGroupSelect(e.target.value)}
              disabled={loadingMembers || !!searchParams.get('groupId')}
            >
              <option value="">Select group</option>
              {availableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {loadingMembers ? (
            <p className="text-sm text-gray-600">Loading members...</p>
          ) : selectedGroupId && groupMembers.length > 0 ? (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Participants <span className="text-red-500">*</span> (minimum 2)
              </label>
              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <label
                    key={member.userId}
                    className="flex items-center p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(member.userId)}
                      onChange={() => handleParticipantToggle(member.userId)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-900">User {member.userId.slice(0, 8)}...</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
