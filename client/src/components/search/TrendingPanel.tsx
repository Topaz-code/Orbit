import { Link } from 'react-router-dom';
import { Hash, TrendingUp } from 'lucide-react';
import { useTrending } from '@/hooks/useSearch';
import { Card } from '@/components/ui/card';

/** Hashtag counts from the last 24 hours. No personalisation, no ranking model. */
export function TrendingPanel({ className }: { className?: string }) {
  const { data, isLoading } = useTrending();
  const items = data?.items ?? [];

  return (
    <Card className={className}>
      <div className="flex items-center gap-2 border-b border-border p-4">
        <TrendingUp className="h-4 w-4 text-[#6366f1]" />
        <h2 className="text-sm font-bold">Trending today</h2>
      </div>

      <div className="p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-4 w-full rounded" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            No hashtags yet today. Add a #tag to a post and it will show up here.
          </p>
        ) : (
          <ul>
            {items.map((item, index) => (
              <li key={item.tag}>
                <Link
                  to={`/search?q=${encodeURIComponent(item.tag)}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#6366f1]/12 to-[#8b5cf6]/12">
                    <Hash className="h-3.5 w-3.5 text-[#6366f1]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.tag}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.count} {item.count === 1 ? 'post' : 'posts'}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        Counted from public posts in the last 24 hours. Orbit does not profile you.
      </p>
    </Card>
  );
}
