import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/components/Card';
import { Input } from '../ui/components/Input';
import { Button } from '../ui/components/Button';

interface SignupScreen1Props {
  onNext: (email: string, password: string) => void;
}

export function SignupScreen1({ onNext }: SignupScreen1Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return;
    }

    // Proceed to next screen
    onNext(email, password);
  };

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      {/* App name OUTSIDE the card */}
      <h1
        style={{
          textAlign: 'center',
          fontSize: 28,
          fontWeight: 600,
          margin: '0 0 16px 0',
          color: '#111827',
        }}
      >
        Splitzy
      </h1>
      <p
        style={{
          textAlign: 'center',
          fontSize: 13,
          color: '#6B7280',
          margin: '0 0 20px 0',
        }}
      >
        Create account
      </p>

      <Card className="p-5">
        <form onSubmit={onSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
                color: '#374151',
              }}
            >
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
                color: '#374151',
              }}
            >
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
            <p style={{ marginTop: 4, fontSize: 12, color: '#6B7280' }}>At least 6 characters</p>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
                color: '#374151',
              }}
            >
              Confirm Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginBottom: 16,
                fontSize: 13,
                color: '#B91C1C',
                background: '#FEF2F2',
                padding: 10,
                borderRadius: 10,
              }}
            >
              {error}
            </div>
          )}

          {/* Button */}
          <div style={{ marginBottom: 14 }}>
            <Button type="submit" style={{ width: '100%' }}>
              Next
            </Button>
          </div>
        </form>

        {/* Link */}
        <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563EB',
              textDecoration: 'underline',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
            }}
          >
            Back to Login
          </button>
        </p>
      </Card>
    </div>
  );
}
