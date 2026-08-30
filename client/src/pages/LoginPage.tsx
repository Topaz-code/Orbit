import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username, email or phone'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { username: 'alexchen', name: 'Alex Chen' },
  { username: 'sarahj', name: 'Sarah Jones' },
  { username: 'mikeross', name: 'Mike Ross' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = async (values: FormValues) => {
    setFormError('');
    try {
      const user = await login(values.identifier, values.password, rememberMe);
      navigate(user.isOnboarded ? redirectTo : '/onboarding', { replace: true });
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Could not sign you in'));
    }
  };

  const useDemoAccount = (username: string) => {
    setValue('identifier', username);
    setValue('password', 'orbit123');
    setFormError('');
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to Orbit?{' '}
          <Link to="/register" className="font-semibold text-[#6366f1] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Username, email or phone</Label>
          <Input
            id="identifier"
            {...register('identifier')}
            error={Boolean(errors.identifier)}
            autoComplete="username"
            autoFocus
            placeholder="alexchen"
          />
          {errors.identifier ? (
            <p className="text-xs text-destructive">{errors.identifier.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-[#6366f1] hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            {...register('password')}
            error={Boolean(errors.password)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label htmlFor="remember" className="cursor-pointer">
              Keep me signed in
            </Label>
            <p className="text-xs text-muted-foreground">Stay logged in on this device for 30 days.</p>
          </div>
          <Switch id="remember" checked={rememberMe} onCheckedChange={setRememberMe} />
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-dashed border-border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-[#f59e0b]" />
          Try a demo account (password <code className="font-mono">orbit123</code>)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.username}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => useDemoAccount(account.username)}
            >
              {account.name}
            </Button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
