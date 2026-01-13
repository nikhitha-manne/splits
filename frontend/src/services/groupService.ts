import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type GroupMemberRole = 'admin' | 'member';
export type InviteType = 'email' | 'link';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Group {
  id: string;
  name: string;
  description?: string;
  parentGroupId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  userId: string;
  role: GroupMemberRole;
  joinedAt: Date;
}

export interface GroupRef {
  groupId: string;
  role: GroupMemberRole;
  parentGroupId?: string | null;
  name?: string;
}

export interface Invite {
  id: string;
  groupId: string;
  createdBy: string;
  type: InviteType;
  email?: string;
  token: string;
  status: InviteStatus;
  createdAt: Date;
  expiresAt?: Date;
  acceptedBy?: string;
  acceptedAt?: Date;
}

/**
 * Create a new group and add creator as admin
 */
export async function createGroup(
  name: string,
  description: string | undefined,
  parentGroupId: string | null | undefined,
  createdBy: string,
  memberEmails: string[]
): Promise<{ groupId: string; inviteIds: string[]; inviteTokens: Array<{ email: string; token: string }> }> {
  const now = serverTimestamp();

  // Create group document
  const groupRef = doc(collection(db, 'groups'));
  const groupData = {
    name,
    description: description || null,
    parentGroupId: parentGroupId || null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(groupRef, groupData);

  const groupId = groupRef.id;

  // Add creator as admin
  await setDoc(doc(db, 'groups', groupId, 'members', createdBy), {
    userId: createdBy,
    role: 'admin',
    joinedAt: now,
  });

  // Create groupRef index for creator
  await setDoc(doc(db, 'users', createdBy, 'groupRefs', groupId), {
    groupId,
    role: 'admin',
    parentGroupId: parentGroupId || null,
    name,
  } as GroupRef);

  // Create invites for member emails
  const inviteIds: string[] = [];
  const inviteTokens: Array<{ email: string; token: string }> = [];
  for (const email of memberEmails) {
    if (!email.trim()) continue;

    const token = generateInviteToken();
    const inviteRef = doc(collection(db, 'invites'));
    const inviteData = {
      groupId,
      createdBy,
      type: 'email' as InviteType,
      email: email.trim().toLowerCase(),
      token,
      status: 'pending' as InviteStatus,
      createdAt: now,
      expiresAt: null, // Can add expiration later
    };

    await setDoc(inviteRef, inviteData);
    inviteIds.push(inviteRef.id);
    inviteTokens.push({ email: email.trim().toLowerCase(), token });
  }

  // Return groupId, inviteIds, and tokens for email sending
  return { 
    groupId, 
    inviteIds,
    inviteTokens,
  };
}

/**
 * List all groups a user belongs to
 */
export async function listUserGroups(userId: string): Promise<(Group & { role: GroupMemberRole; parentGroupId?: string | null })[]> {
  const groupRefsQuery = query(collection(db, 'users', userId, 'groupRefs'));
  const groupRefsSnapshot = await getDocs(groupRefsQuery);

  const groups: (Group & { role: GroupMemberRole; parentGroupId?: string | null })[] = [];

  for (const groupRefDoc of groupRefsSnapshot.docs) {
    const groupRefData = groupRefDoc.data() as GroupRef;
    const groupId = groupRefData.groupId;

    // Fetch group document
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (groupDoc.exists()) {
      const groupData = groupDoc.data();
      groups.push({
        id: groupId,
        name: groupData.name,
        description: groupData.description,
        parentGroupId: groupData.parentGroupId || null,
        createdBy: groupData.createdBy,
        createdAt: groupData.createdAt?.toDate() || new Date(),
        updatedAt: groupData.updatedAt?.toDate() || new Date(),
        role: groupRefData.role,
      });
    }
  }

  return groups;
}

/**
 * Get a single group by ID
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  const groupDoc = await getDoc(doc(db, 'groups', groupId));
  if (!groupDoc.exists()) {
    return null;
  }

  const data = groupDoc.data();
  return {
    id: groupDoc.id,
    name: data.name,
    description: data.description,
    parentGroupId: data.parentGroupId || null,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

/**
 * List all members of a group
 */
export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const membersQuery = query(collection(db, 'groups', groupId, 'members'));
  const membersSnapshot = await getDocs(membersQuery);

  const members: GroupMember[] = [];
  for (const memberDoc of membersSnapshot.docs) {
    const data = memberDoc.data();
    members.push({
      userId: data.userId,
      role: data.role,
      joinedAt: data.joinedAt?.toDate() || new Date(),
    });
  }

  return members;
}

/**
 * Create an email invite for a group
 */
export async function createInviteEmail(
  groupId: string,
  email: string,
  createdBy: string
): Promise<{ inviteId: string; token: string }> {
  // Verify user is admin (check membership)
  const memberDoc = await getDoc(doc(db, 'groups', groupId, 'members', createdBy));
  if (!memberDoc.exists()) {
    throw new Error('You must be a member of this group');
  }

  const memberData = memberDoc.data();
  if (memberData.role !== 'admin') {
    throw new Error('Only admins can create invites');
  }

  const token = generateInviteToken();
  const inviteRef = doc(collection(db, 'invites'));
  const inviteData = {
    groupId,
    createdBy,
    type: 'email' as InviteType,
    email: email.trim().toLowerCase(),
    token,
    status: 'pending' as InviteStatus,
    createdAt: serverTimestamp(),
    expiresAt: null,
  };

  await setDoc(inviteRef, inviteData);
  
  // Return both inviteId and token for email sending
  return { inviteId: inviteRef.id, token };
}

/**
 * Create a link invite for a group
 */
export async function createInviteLink(groupId: string, createdBy: string): Promise<{ inviteId: string; token: string }> {
  // Verify user is admin
  const memberDoc = await getDoc(doc(db, 'groups', groupId, 'members', createdBy));
  if (!memberDoc.exists()) {
    throw new Error('You must be a member of this group');
  }

  const memberData = memberDoc.data();
  if (memberData.role !== 'admin') {
    throw new Error('Only admins can create invites');
  }

  const token = generateInviteToken();
  const inviteRef = doc(collection(db, 'invites'));
  const inviteData = {
    groupId,
    createdBy,
    type: 'link' as InviteType,
    token,
    status: 'pending' as InviteStatus,
    createdAt: serverTimestamp(),
    expiresAt: null,
  };

  await setDoc(inviteRef, inviteData);
  return { inviteId: inviteRef.id, token };
}

/**
 * Accept an invite by token
 */
export async function acceptInviteByToken(token: string, userId: string): Promise<{ groupId: string; groupName: string }> {
  // Find invite by token
  const invitesQuery = query(collection(db, 'invites'), where('token', '==', token));
  const invitesSnapshot = await getDocs(invitesQuery);

  if (invitesSnapshot.empty) {
    throw new Error('Invalid invite token');
  }

  const inviteDoc = invitesSnapshot.docs[0];
  const inviteData = inviteDoc.data();

  // Validate invite status
  if (inviteData.status !== 'pending') {
    throw new Error('This invite is no longer valid');
  }

  // Check expiration (if set)
  if (inviteData.expiresAt) {
    const expiresAt = inviteData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      throw new Error('This invite has expired');
    }
  }

  const groupId = inviteData.groupId;

  // Check if user is already a member
  const existingMemberDoc = await getDoc(doc(db, 'groups', groupId, 'members', userId));
  if (existingMemberDoc.exists()) {
    throw new Error('You are already a member of this group');
  }

  // Get group info
  const groupDoc = await getDoc(doc(db, 'groups', groupId));
  if (!groupDoc.exists()) {
    throw new Error('Group not found');
  }

  const groupData = groupDoc.data();
  const groupName = groupData.name;

  // Add user as member
  await setDoc(doc(db, 'groups', groupId, 'members', userId), {
    userId,
    role: 'member', // Always add as member (can promote later)
    joinedAt: serverTimestamp(),
  });

  // Create groupRef index
  await setDoc(doc(db, 'users', userId, 'groupRefs', groupId), {
    groupId,
    role: 'member',
    parentGroupId: groupData.parentGroupId || null,
    name: groupName,
  });

  // Update invite status
  await updateDoc(doc(db, 'invites', inviteDoc.id), {
    status: 'accepted',
    acceptedBy: userId,
    acceptedAt: serverTimestamp(),
  });

  return { groupId, groupName };
}

/**
 * Generate a unique, unguessable invite token
 */
function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Get user's role in a group
 */
export async function getUserRoleInGroup(groupId: string, userId: string): Promise<GroupMemberRole | null> {
  const memberDoc = await getDoc(doc(db, 'groups', groupId, 'members', userId));
  if (!memberDoc.exists()) {
    return null;
  }
  return memberDoc.data().role;
}
