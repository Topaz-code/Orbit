import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useNotificationStore, type ToastMessage } from '@/stores/notificationStore';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  default: Info,
} as const;

const TONES = {
  success: 'text-[#22c55e]',
  error: 'text-destructive',
  info: 'text-[#06b6d4]',
  default: 'text-primary',
} as const;

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismiss = useNotificationStore((state) => state.dismissToast);
  const navigate = useNavigate();
  const Icon = ICONS[toast.variant ?? 'default'];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id, toast.duration]);

  const clickable = Boolean(toast.href);

  return (
    <div
      role="status"
      onClick={() => {
        if (toast.href) {
          navigate(toast.href);
          dismiss(toast.id);
        }
      }}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-3.5 shadow-lg animate-slide-in-right',
        clickable && 'cursor-pointer transition-colors hover:bg-secondary/60',
      )}
    >
      {toast.avatarUrl ? (
        <UserAvatar user={{ displayName: toast.title, avatarUrl: toast.avatarUrl }} className="h-9 w-9" />
      ) : (
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONES[toast.variant ?? 'default'])} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={(event) => {
          event.stopPropagation();
          dismiss(toast.id);
        }}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Fixed top-right stack. Rendered once at the app root. */
export function Toaster() {
  const toasts = useNotificationStore((state) => state.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
