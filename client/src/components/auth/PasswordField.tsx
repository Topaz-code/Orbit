import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';

/** Password input with a visibility toggle and an optional strength meter. */
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  InputProps & { showStrength?: boolean; value?: string }
>(({ className, showStrength, value, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  const strength = showStrength ? passwordStrength(String(value ?? '')) : null;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          value={value}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {strength && String(value ?? '').length > 0 ? (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  index < strength.score ? strength.className : 'bg-secondary',
                )}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{strength.label}</p>
        </div>
      ) : null}
    </div>
  );
});
PasswordField.displayName = 'PasswordField';

function passwordStrength(password: string): { score: number; label: string; className: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: 'Weak — add more characters', className: 'bg-[#ef4444]' };
  if (score === 2) return { score: 2, label: 'Fair — mix in capitals or numbers', className: 'bg-[#f59e0b]' };
  if (score === 3) return { score: 3, label: 'Good password', className: 'bg-[#06b6d4]' };
  return { score: 4, label: 'Strong password', className: 'bg-[#22c55e]' };
}
