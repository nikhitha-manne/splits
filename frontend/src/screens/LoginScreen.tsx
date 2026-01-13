import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../ui/components/Card';
import { Input } from '../ui/components/Input';
import { Button } from '../ui/components/Button';

export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      {/* App name OUTSIDE the card */}
      <h1
        style={{
          textAlign: 'center',
          fontSize: 28,
          fontWeight: 600,
          margin: '0 0 16px 0', // ✅ reduced to keep block optically centered
          color: '#111827',
        }}
      >
        Splitzy
      </h1>

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
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
            <Button type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </form>

        {/* Link */}
        <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            style={{ color: '#2563EB', textDecoration: 'underline', fontWeight: 600 }}
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
