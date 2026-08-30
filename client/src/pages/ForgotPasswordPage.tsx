import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, ShieldQuestion } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from '@/stores/notificationStore';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Two-step recovery. Orbit has no mail server by design, so the security question set at
 * registration is what proves ownership of an account.
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'identify' | 'answer'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const findAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post<{ hasAccount: boolean; securityQuestion: string }>(
        '/auth/forgot-password',
        { identifier: identifier.trim() },
      );
      if (!response.data.hasAccount) {
        setError('We could not find an account with a security question set for that detail.');
        return;
      }
      setQuestion(response.data.securityQuestion);
      setStep('answer');
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        identifier: identifier.trim(),
        securityAnswer: answer.trim(),
        newPassword,
      });
      toast.success('Password updated', 'Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'That answer does not match our records'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={step === 'identify' ? 'Reset your password' : 'Answer your security question'}
      subtitle={
        step === 'identify'
          ? 'Tell us which account needs a new password.'
          : 'Answer correctly and you can choose a new password right away.'
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-[#6366f1] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      {step === 'identify' ? (
        <form onSubmit={findAccount} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Username, email or phone</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="alexchen"
              autoFocus
              error={Boolean(error)}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!identifier.trim()}>
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4" noValidate>
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 p-3">
            <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
            <p className="text-sm font-medium">{question}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="answer">Your answer</Label>
            <Input
              id="answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              autoFocus
              placeholder="Answer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordField
              id="newPassword"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              showStrength
              placeholder="At least 8 characters"
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
            disabled={!answer.trim() || !newPassword}
          >
            <KeyRound className="h-4 w-4" />
            Set new password
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('identify')}>
            Use a different account
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
