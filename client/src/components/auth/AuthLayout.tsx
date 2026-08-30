import { Link } from 'react-router-dom';
import { Database, Server, ShieldCheck, WifiOff } from 'lucide-react';
import { APP_TAGLINE } from '@/lib/constants';
import { OrbitLogo, OrbitWordmark } from '@/components/shared/OrbitLogo';

const PROMISES = [
  { icon: ShieldCheck, title: 'No ads, ever', description: 'Nothing about you is for sale.' },
  { icon: Server, title: 'Self-hosted', description: 'Run Orbit on your own machine.' },
  { icon: Database, title: 'Your data stays put', description: 'One SQLite file you control.' },
  { icon: WifiOff, title: 'No trackers', description: 'Zero third-party analytics.' },
];

/** Split-screen frame shared by login, register and password recovery. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#8b5cf6] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-[#06b6d4]/20 blur-3xl" />

        <Link to="/" className="relative flex items-center gap-2.5">
          <OrbitLogo className="h-9 w-9 [&_circle]:fill-white [&_ellipse]:stroke-white" spinning />
          <span className="text-2xl font-bold tracking-tight">Orbit</span>
        </Link>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <h2 className="max-w-md text-4xl font-bold leading-tight">
              A social network that belongs to you.
            </h2>
            <p className="max-w-sm text-white/80">{APP_TAGLINE}</p>
          </div>

          <ul className="grid max-w-md grid-cols-2 gap-4">
            {PROMISES.map((promise) => {
              const Icon = promise.icon;
              return (
                <li key={promise.title} className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                  <Icon className="mb-2 h-5 w-5" />
                  <p className="text-sm font-semibold">{promise.title}</p>
                  <p className="text-xs text-white/70">{promise.description}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Open source under the MIT licence. Built for people who would rather not be the product.
        </p>
      </aside>

      <main className="flex w-full flex-col items-center justify-center px-5 py-10 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="mb-7 lg:hidden">
            <OrbitWordmark />
          </div>

          <div className="mb-6 space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
