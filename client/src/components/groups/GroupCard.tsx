import { Link } from 'react-router-dom';
import { Globe, Lock, Users } from 'lucide-react';
import { cn, mediaUrl } from '@/lib/utils';
import { useJoinGroup } from '@/hooks/useGroups';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Group } from '@/types';

export function GroupCard({ group, className }: { group: Group; className?: string }) {
  const joinGroup = useJoinGroup();
  const PrivacyIcon = group.privacy === 'private' ? Lock : Globe;

  return (
    <Card className={cn('flex flex-col overflow-hidden transition-shadow hover:shadow-md', className)}>
      <Link to={`/groups/${group.id}`} className="relative block h-24 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
        {group.coverUrl ? (
          <img src={mediaUrl(group.coverUrl)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : null}
        <span className="absolute right-2 top-2">
          <Badge variant={group.privacy === 'private' ? 'secondary' : 'accent'} className="gap-1">
            <PrivacyIcon className="h-3 w-3" />
            {group.privacy === 'private' ? 'Private' : 'Public'}
          </Badge>
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="-mt-10 flex items-end gap-3">
          <Link to={`/groups/${group.id}`}>
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border-4 border-card bg-muted">
              {group.avatarUrl ? (
                <img src={mediaUrl(group.avatarUrl)} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Users className="h-5 w-5 text-muted-foreground" />
              )}
            </span>
          </Link>
        </div>

        <div className="min-w-0">
          <Link to={`/groups/${group.id}`} className="block truncate font-semibold hover:underline">
            {group.name}
          </Link>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {group.memberCount} / {group.maxMembers} members
          </p>
        </div>

        {group.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{group.description}</p>
        ) : null}

        <div className="mt-auto pt-2">
          {group.isMember ? (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to={`/groups/${group.id}`}>Open group</Link>
            </Button>
          ) : group.isFull ? (
            <Button variant="outline" size="sm" className="w-full" disabled>
              Group is full
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              loading={joinGroup.isPending}
              onClick={() => joinGroup.mutate({ groupId: group.id })}
            >
              Join group
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
