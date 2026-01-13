import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../ui/components/Card';
import { Input } from '../ui/components/Input';
import { Select } from '../ui/components/Select';
import { Button } from '../ui/components/Button';

const currencies = [
  { code: 'USD', name: 'US Dollar (USD)' },
  { code: 'INR', name: 'Indian Rupee (INR)' },
  { code: 'EUR', name: 'Euro (EUR)' },
  { code: 'GBP', name: 'British Pound (GBP)' },
  { code: 'CAD', name: 'Canadian Dollar (CAD)' },
  { code: 'AUD', name: 'Australian Dollar (AUD)' },
];

interface SignupScreen2Props {
  email: string;
  password: string;
}

export function SignupScreen2({ email, password }: SignupScreen2Props) {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!defaultCurrency) {
      setError('Please select a default currency');
      return;
    }

    setSubmitting(true);

    try {
      await signup({
        email,
        password,
        name: name.trim(),
        defaultCurrency,
      });
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
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
          {/* Name */}
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
              Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Enter your full name"
            />
          </div>

          {/* Default Currency */}
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
              Default Currency
            </label>
            <Select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              required
            >
              <option value="">Select currency</option>
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.name}
                </option>
              ))}
            </Select>
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
              {submitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
