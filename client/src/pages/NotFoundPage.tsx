import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrbitLogo } from '@/components/shared/OrbitLogo';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center animate-fade-in-up">
        <OrbitLogo className="h-20 w-20" spinning />
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold">Lost in space</h1>
          <p className="text-sm text-muted-foreground">
            This page drifted out of orbit. Let us get you back to something familiar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4" />
              Back to feed
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/explore">
              <Compass className="h-4 w-4" />
              Explore
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
