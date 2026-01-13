import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { listUserGroups } from '../../../services/groupService';
import { getDirectThread } from '../../../services/directService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { type Currency } from '../../../services/currencyService';
import { type UserInfo } from '../types';
import { type Group } from '../../../services/groupService';

interface UseAddExpenseQueryParamsParams {
  setContainerType: (type: 'group' | 'direct') => void;
  setSelectedGroupId: (id: string) => void;
  setSelectedDirectId: (id: string) => void;
  setCurrency: (currency: Currency) => void;
  setAvailableGroups: (groups: (Group & { role: string })[]) => void;
  setDirectOtherUser: (user: UserInfo | null) => void;
  loadGroupMembers: (groupId: string) => Promise<void>;
}

/**
 * Hook to handle query param initialization and locking
 */
export function useAddExpenseQueryParams({
  setContainerType,
  setSelectedGroupId,
  setSelectedDirectId,
  setCurrency,
  setAvailableGroups,
  setDirectOtherUser,
  loadGroupMembers,
}: UseAddExpenseQueryParamsParams) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!user) return;

    const mode = searchParams.get('mode');
    const directIdParam = searchParams.get('directId');
    const groupIdParam = searchParams.get('groupId');

    // Load user groups (always needed)
    const loadUserGroups = async () => {
      try {
        const groups = await listUserGroups(user.uid);
        setAvailableGroups(groups);
      } catch (err) {
        console.error('Failed to load groups:', err);
      }
    };

    // Load direct thread if directId is provided
    const loadDirectThread = async (directId: string) => {
      try {
        const thread = await getDirectThread(directId);
        if (thread) {
          const otherUserId = thread.memberIds.find((id) => id !== user.uid) || thread.memberIds[0];
          const otherUserDoc = await getDoc(doc(db, 'publicUsers', otherUserId));
          if (otherUserDoc.exists()) {
            const otherUserData = otherUserDoc.data();
            // For display, we only have name/email from publicUsers
            // defaultCurrency needs to come from private user doc, but we can use current user's default as fallback
            setDirectOtherUser({
              uid: otherUserDoc.id,
              name: otherUserData.name,
              email: otherUserData.email || '',
              defaultCurrency: user.defaultCurrency, // Use current user's currency as fallback
            });
          }
        }
      } catch (err) {
        console.error('Failed to load direct thread:', err);
      }
    };

    // Initialize from query params
    if (mode === 'direct' || directIdParam) {
      setContainerType('direct');
      if (directIdParam) {
        setSelectedDirectId(directIdParam);
        loadDirectThread(directIdParam);
      }
    } else if (mode === 'group' || groupIdParam) {
      setContainerType('group');
      if (groupIdParam) {
        setSelectedGroupId(groupIdParam);
        loadGroupMembers(groupIdParam);
      }
    }

    setCurrency((user.defaultCurrency as Currency) || 'USD');
    loadUserGroups();
  }, [user, searchParams, setContainerType, setSelectedGroupId, setSelectedDirectId, setCurrency, setAvailableGroups, setDirectOtherUser, loadGroupMembers]);
}
