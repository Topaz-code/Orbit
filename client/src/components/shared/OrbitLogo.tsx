import { cn } from '@/lib/utils';

/** The Orbit mark: a planet with an inclined orbital ring. */
export function OrbitLogo({ className, spinning }: { className?: string; spinning?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-8 w-8', className)} role="img" aria-label="Orbit">
      <defs>
        <linearGradient id="orbit-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="9" fill="url(#orbit-logo-gradient)" />
      <g className={spinning ? 'origin-center animate-ring-spin' : undefined}>
        <ellipse
          cx="24"
          cy="24"
          rx="21"
          ry="8.5"
          fill="none"
          stroke="url(#orbit-logo-gradient)"
          strokeWidth="2.5"
          transform="rotate(-28 24 24)"
        />
        <circle cx="42" cy="15" r="3" fill="#06b6d4" />
      </g>
    </svg>
  );
}

export function OrbitWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <OrbitLogo />
      <span className="text-xl font-bold tracking-tight orbit-gradient-text">Orbit</span>
    </span>
  );
}
