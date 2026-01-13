import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listUserGroups, type Group } from '../services/groupService';
import { Card } from '../ui/components/Card';
import { Button } from '../ui/components/Button';
import { theme } from '../ui/theme';

export function GroupsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<(Group & { role: string; parentGroupId?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    loadGroups();
  }, [user]);

  const loadGroups = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const userGroups = await listUserGroups(user.uid);
      setGroups(userGroups);
    } catch (err: any) {
      console.error('FIREBASE/FIRESTORE ERROR:', err);
      console.error('ERROR PROPS:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(err?.message || 'Missing or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = () => {
    navigate('/groups/create');
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/groups/${groupId}`);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}
      >
        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
          Loading groups...
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
          Groups
        </h1>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 border rounded text-sm" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: theme.colors.negative }}>
          {error}
        </div>
      )}

      <div className="px-4 py-6" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {groups.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="mb-4" style={{ color: theme.colors.textSecondary }}>
              No groups yet
            </p>
            <Button onClick={handleCreateGroup}>Create Your First Group</Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <Card
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className="p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="font-medium" style={{ color: theme.colors.textPrimary }}>
                      {group.name}
                    </h2>
                    {group.parentGroupId && (
                      <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                        {groups.find((g) => g.id === group.parentGroupId)?.name || 'Parent group'}
                      </p>
                    )}
                    {group.description && (
                      <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                        {group.description}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: group.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                      color: group.role === 'admin' ? '#1e40af' : theme.colors.textSecondary,
                    }}
                  >
                    {group.role}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="fixed" style={{ bottom: '100px', right: theme.spacing.lg }}>
        <button
          onClick={handleCreateGroup}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl font-light transition-colors"
          style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
          aria-label="Create group"
        >
          +
        </button>
      </div>
    </div>
  );
}
