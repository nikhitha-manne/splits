import { useState } from 'react';
import { SignupScreen1 } from './SignupScreen1';
import { SignupScreen2 } from './SignupScreen2';

export function SignupScreen() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleScreen1Next = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
    setStep(2);
  };

  if (step === 1) {
    return <SignupScreen1 onNext={handleScreen1Next} />;
  }

  return <SignupScreen2 email={email} password={password} />;
}
