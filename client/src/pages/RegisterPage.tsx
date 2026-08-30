import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useSearch';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Tell us your name').max(60),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'At least 3 characters')
      .max(30, 'At most 30 characters')
      .regex(/^[a-z0-9_]+$/, 'Letters, numbers and underscores only'),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().min(6, 'Enter a valid phone number').max(20),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string(),
    securityAnswer: z.string().trim().min(1, 'Answer the security question'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

const SECURITY_QUESTION = 'What is the name of this app?';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount } = useAuth();
  const [formError, setFormError] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      securityAnswer: '',
    },
  });

  const username = watch('username');
  const password = watch('password');
  const debouncedUsername = useDebouncedValue(username, 400);

  // Live username availability check.
  useEffect(() => {
    const value = debouncedUsername?.trim().toLowerCase();
    if (!value || value.length < 3 || !/^[a-z0-9_]+$/.test(value)) {
      setAvailable(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    api
      .get<{ available: boolean }>('/auth/check-username', { params: { username: value } })
      .then((response) => {
        if (!cancelled) setAvailable(response.data.available);
      })
      .catch(() => {
        if (!cancelled) setAvailable(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedUsername]);

  const onSubmit = async (values: FormValues) => {
    setFormError('');
    try {
      await registerAccount({
        displayName: values.displayName,
        username: values.username,
        email: values.email,
        phone: values.phone,
        password: values.password,
        securityQuestion: SECURITY_QUESTION,
        securityAnswer: values.securityAnswer,
      });
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Could not create your account'));
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes about a minute. No email confirmation, no tracking."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#6366f1] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Your name</Label>
          <Input
            id="displayName"
            {...register('displayName')}
            error={Boolean(errors.displayName)}
            autoComplete="name"
            placeholder="Alex Chen"
          />
          {errors.displayName ? (
            <p className="text-xs text-destructive">{errors.displayName.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              @
            </span>
            <Input
              id="username"
              {...register('username')}
              error={Boolean(errors.username)}
              autoComplete="username"
              className="pl-7 pr-9"
              placeholder="alexchen"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : available === true ? (
                <Check className="h-4 w-4 text-[#22c55e]" />
              ) : available === false ? (
                <X className="h-4 w-4 text-destructive" />
              ) : null}
            </span>
          </div>
          {errors.username ? (
            <p className="text-xs text-destructive">{errors.username.message}</p>
          ) : available === false ? (
            <p className="text-xs text-destructive">That username is taken</p>
          ) : available === true ? (
            <p className="text-xs text-[#22c55e]">Nice — that one is free</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              error={Boolean(errors.email)}
              autoComplete="email"
              placeholder="you@example.com"
            />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
              error={Boolean(errors.phone)}
              autoComplete="tel"
              placeholder="+15550100"
            />
            {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordField
            id="password"
            {...register('password')}
            error={Boolean(errors.password)}
            autoComplete="new-password"
            showStrength
            value={password}
            placeholder="At least 8 characters"
          />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordField
            id="confirmPassword"
            {...register('confirmPassword')}
            error={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="securityAnswer">{SECURITY_QUESTION}</Label>
          <Input
            id="securityAnswer"
            {...register('securityAnswer')}
            error={Boolean(errors.securityAnswer)}
            placeholder="Your answer"
          />
          <p className="text-xs text-muted-foreground">
            Used to reset your password. There is no email server, so keep the answer memorable.
          </p>
          {errors.securityAnswer ? (
            <p className="text-xs text-destructive">{errors.securityAnswer.message}</p>
          ) : null}
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
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
