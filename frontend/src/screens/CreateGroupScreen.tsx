import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createGroup, listUserGroups, type Group } from '../services/groupService';
import { sendInviteEmail } from '../services/inviteEmailService';

export function CreateGroupScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentGroupId, setParentGroupId] = useState<string>('');
  const [memberEmails, setMemberEmails] = useState('');
  const [availableGroups, setAvailableGroups] = useState<(Group & { role: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    loadUserGroups();
  }, [user]);

  const loadUserGroups = async () => {
    if (!user) return;

    try {
      const groups = await listUserGroups(user.uid);
      setAvailableGroups(groups);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    if (!user) {
      setError('You must be logged in');
      return;
    }

    setSubmitting(true);

    try {
      // Parse member emails (comma or newline separated)
      const emails = memberEmails
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const { groupId, inviteTokens } = await createGroup(
        name.trim(),
        description.trim() || undefined,
        parentGroupId || null,
        user.uid,
        emails
      );

      // Send invite emails for each invite
      if (inviteTokens.length > 0) {
        const appBaseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
        const inviterName = user.name || 'Someone';
        const groupName = name.trim();

        // Send emails in parallel (don't block navigation on failures)
        Promise.all(
          inviteTokens.map(async ({ email, token }) => {
            const inviteLink = `${appBaseUrl}/invite/${token}`;
            try {
              await sendInviteEmail({
                toEmail: email,
                inviteLink,
                inviterName,
                groupName,
                type: 'group',
              });
            } catch (err) {
              console.error(`Failed to send email to ${email}:`, err);
              // Continue with other emails even if one fails
            }
          })
        ).catch((err) => {
          console.error('Error sending invite emails:', err);
          // Don't block navigation - emails are sent asynchronously
        });
      }

      navigate(`/groups/${groupId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-semibold text-gray-900">Create Group</h1>
      </div>

      <form onSubmit={onSubmit} className="px-4 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Group Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Weekend Trip"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Description (optional)</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Parent Group (optional)</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={parentGroupId}
            onChange={(e) => setParentGroupId(e.target.value)}
          >
            <option value="">None (Top-level group)</option>
            {availableGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Add Members by Email</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            value={memberEmails}
            onChange={(e) => setMemberEmails(e.target.value)}
            placeholder="Enter email addresses separated by commas or new lines&#10;e.g., user1@example.com, user2@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            Invites will be sent to these email addresses
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/groups')}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            {submitting ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}
