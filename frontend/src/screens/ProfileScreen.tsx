import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { updateUserProfile } from '../services/authService';
import { type Currency } from '../services/currencyService';
import { Card } from '../ui/components/Card';
import { Button } from '../ui/components/Button';
import { Input } from '../ui/components/Input';
import { Select } from '../ui/components/Select';
import { theme } from '../ui/theme';

export function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState(user?.name || '');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>((user?.defaultCurrency as Currency) || 'USD');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(user?.profilePhotoUrl || '');

  // Validation state
  const [nameError, setNameError] = useState<string | null>(null);
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  const handleEdit = () => {
    if (!user) return;
    setName(user.name);
    setDefaultCurrency((user.defaultCurrency as Currency) || 'USD');
    setPhone(user.phone || '');
    setProfilePhotoUrl(user.profilePhotoUrl || '');
    setError(null);
    setNameError(null);
    setCurrencyError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (!user) return;
    setName(user.name);
    setDefaultCurrency((user.defaultCurrency as Currency) || 'USD');
    setPhone(user.phone || '');
    setProfilePhotoUrl(user.profilePhotoUrl || '');
    setError(null);
    setNameError(null);
    setCurrencyError(null);
    setIsEditing(false);
  };

  const validateForm = (): boolean => {
    let isValid = true;

    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError(null);
    }

    if (!defaultCurrency) {
      setCurrencyError('Default currency is required');
      isValid = false;
    } else {
      setCurrencyError(null);
    }

    return isValid;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateUserProfile({
        name: name.trim(),
        defaultCurrency: defaultCurrency,
        phone: phone.trim() || null,
        profilePhotoUrl: profilePhotoUrl.trim() || null,
      });

      // Refresh user data in context
      await refreshUser();

      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      setError(err.message || 'Failed to logout');
    }
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background, paddingBottom: '80px' }}>
      <div
        className="border-b sticky top-0 z-30"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
      >
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
            Profile
          </h1>
        </div>
      </div>

      <div className="px-4 py-6" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {error && (
          <div className="mb-4 p-3 border rounded text-sm" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: theme.colors.negative }}>
            {error}
          </div>
        )}

        {!isEditing ? (
          // View Mode
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex justify-center">
              {user.profilePhotoUrl ? (
                <img
                  src={user.profilePhotoUrl}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover"
                  style={{ border: `2px solid ${theme.colors.border}` }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#e5e7eb', border: `2px solid ${theme.colors.border}` }}
                >
                  <span className="text-3xl font-medium" style={{ color: theme.colors.textSecondary }}>
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <h2 className="text-2xl font-semibold text-center" style={{ color: theme.colors.textPrimary }}>
                {user.name}
              </h2>
            </div>

            {/* Details */}
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
                    Email
                  </label>
                  <p className="text-sm" style={{ color: theme.colors.textPrimary }}>
                    {user.email}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
                    Default Currency
                  </label>
                  <p className="text-sm" style={{ color: theme.colors.textPrimary }}>
                    {user.defaultCurrency}
                  </p>
                </div>

                {user.phone && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
                      Phone
                    </label>
                    <p className="text-sm" style={{ color: theme.colors.textPrimary }}>
                      {user.phone}
                    </p>
                  </div>
                )}

                {user.profilePhotoUrl && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
                      Profile Photo URL
                    </label>
                    <p className="text-sm break-all" style={{ color: theme.colors.textPrimary }}>
                      {user.profilePhotoUrl}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button onClick={handleEdit} className="w-full">
                Edit Profile
              </Button>
              <Button onClick={handleLogout} variant="ghost" className="w-full">
                Logout
              </Button>
            </div>
          </div>
        ) : (
          // Edit Mode
          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Preview */}
            <div className="flex justify-center">
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt={name || 'Profile'}
                  className="w-24 h-24 rounded-full object-cover"
                  style={{ border: `2px solid ${theme.colors.border}` }}
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#e5e7eb', border: `2px solid ${theme.colors.border}` }}
                >
                  <span className="text-3xl font-medium" style={{ color: theme.colors.textSecondary }}>
                    {(name || user.name).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Editable Fields */}
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.textPrimary }}>
                    Name <span style={{ color: theme.colors.negative }}>*</span>
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Your name"
                    error={!!nameError}
                    required
                  />
                  {nameError && (
                    <p className="text-xs mt-1" style={{ color: theme.colors.negative }}>
                      {nameError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
                    Email
                  </label>
                  <Input
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.textPrimary }}>
                    Default Currency <span style={{ color: theme.colors.negative }}>*</span>
                  </label>
                  <Select
                    value={defaultCurrency}
                    onChange={(e) => {
                      setDefaultCurrency(e.target.value as Currency);
                      if (currencyError) setCurrencyError(null);
                    }}
                    error={!!currencyError}
                    required
                  >
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </Select>
                  {currencyError && (
                    <p className="text-xs mt-1" style={{ color: theme.colors.negative }}>
                      {currencyError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.textPrimary }}>
                    Phone (optional)
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.textPrimary }}>
                    Profile Photo URL (optional)
                  </label>
                  <Input
                    type="url"
                    value={profilePhotoUrl}
                    onChange={(e) => setProfilePhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button type="button" onClick={handleCancel} disabled={saving} variant="ghost" className="w-full">
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
