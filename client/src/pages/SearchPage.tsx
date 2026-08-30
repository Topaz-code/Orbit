import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Search as SearchIcon, X } from 'lucide-react';
import { useRecentSearches, useSearch, type SearchType } from '@/hooks/useSearch';
import { UserCard } from '@/components/profile/UserCard';
import { PostCard } from '@/components/feed/PostCard';
import { GroupCard } from '@/components/groups/GroupCard';
import { TrendingPanel } from '@/components/search/TrendingPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Group } from '@/types';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [term, setTerm] = useState(initialQuery);
  const [type, setType] = useState<SearchType>('all');
  const { recent, addRecent, removeRecent, clearRecent } = useRecentSearches();

  const { data, isFetching } = useSearch(term, type);

  // Keep the URL in sync so results can be shared or reloaded.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed) {
      setParams({ q: trimmed }, { replace: true });
      const timer = setTimeout(() => addRecent(trimmed), 1200);
      return () => clearTimeout(timer);
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const people = data?.people ?? [];
  const posts = data?.posts ?? [];
  const groups = data?.groups ?? [];
  const total = people.length + posts.length + groups.length;
  const hasQuery = term.trim().length > 0;

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search people, posts and groups"
            className="h-12 pl-11 pr-11 text-base"
            autoFocus
            aria-label="Search"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {hasQuery ? (
          <>
            <Tabs value={type} onValueChange={(value) => setType(value as SearchType)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="people">People {people.length ? `(${people.length})` : ''}</TabsTrigger>
                <TabsTrigger value="posts">Posts {posts.length ? `(${posts.length})` : ''}</TabsTrigger>
                <TabsTrigger value="groups">Groups {groups.length ? `(${groups.length})` : ''}</TabsTrigger>
              </TabsList>
            </Tabs>

            {isFetching && total === 0 ? (
              <CardGridSkeleton count={4} />
            ) : total === 0 ? (
              <Card>
                <EmptyState
                  icon={SearchIcon}
                  title={`No results for “${term.trim()}”`}
                  description="Try a shorter term, a @username, or a #hashtag."
                />
              </Card>
            ) : (
              <div className="space-y-6">
                {people.length > 0 && (type === 'all' || type === 'people') ? (
                  <section className="space-y-2">
                    <h2 className="text-sm font-bold">People</h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {people.map((person) => (
                        <UserCard key={person.id} user={person} relationship={person.relationship} />
                      ))}
                    </div>
                  </section>
                ) : null}

                {groups.length > 0 && (type === 'all' || type === 'groups') ? (
                  <section className="space-y-2">
                    <h2 className="text-sm font-bold">Groups</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {groups.map((group) => (
                        <GroupCard
                          key={group.id}
                          group={
                            {
                              ...group,
                              postCount: 0,
                              createdAt: '',
                              creator: { id: '', username: '', displayName: '', avatarUrl: '' },
                              role: null,
                              isAdmin: false,
                              inviteCode: null,
                            } satisfies Group
                          }
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {posts.length > 0 && (type === 'all' || type === 'posts') ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-bold">Posts</h2>
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </section>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <>
            {recent.length > 0 ? (
              <Card>
                <div className="flex items-center justify-between border-b border-border p-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Recent searches
                  </h2>
                  <Button variant="ghost" size="sm" onClick={clearRecent}>
                    Clear
                  </Button>
                </div>
                <ul className="p-2">
                  {recent.map((item) => (
                    <li key={item} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTerm(item)}
                        className="flex-1 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
                      >
                        {item}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => removeRecent(item)}
                        aria-label={`Remove ${item}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={SearchIcon}
                  title="Search Orbit"
                  description="Find people by name or @username, posts by keyword, and groups by topic. Searches are never logged on the server."
                  action={
                    <Button variant="outline" asChild>
                      <Link to="/explore">Browse explore instead</Link>
                    </Button>
                  }
                />
              </Card>
            )}
          </>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-[4.5rem]">
          <TrendingPanel />
        </div>
      </aside>
    </div>
  );
}
