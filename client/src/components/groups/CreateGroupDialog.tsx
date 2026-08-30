import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_GROUP_MEMBERS } from '@/lib/constants';
import { useCreateGroup } from '@/hooks/useGroups';
import { useFriends } from '@/hooks/useFriends';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const schema = z.object({
  name: z.string().trim().min(2, 'Give the group a name').max(60),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

export function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const { data: friends } = useFriends();

  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [selected, setSelected] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const remaining = MAX_GROUP_MEMBERS - 1 - selected.length;

  const onSubmit = (values: FormValues) => {
    createGroup.mutate(
      { ...values, privacy, memberIds: selected },
      {
        onSuccess: (group) => {
          reset();
          setSelected([]);
          setPrivacy('public');
          onOpenChange(false);
          navigate(`/groups/${group.id}`);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>
            Groups stay small on purpose — up to {MAX_GROUP_MEMBERS} people, including you. Every group
            gets its own chat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              {...register('name')}
              error={Boolean(errors.name)}
              placeholder="Film club, study group, band…"
              maxLength={60}
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              {...register('description')}
              error={Boolean(errors.description)}
              placeholder="What is this group about?"
              rows={3}
              maxLength={500}
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Privacy</Label>
            <div className="grid grid-cols-2 gap-2">
              <PrivacyOption
                icon={Globe}
                title="Public"
                description="Anyone can find and join"
                active={privacy === 'public'}
                onClick={() => setPrivacy('public')}
              />
              <PrivacyOption
                icon={Lock}
                title="Private"
                description="Invite link only"
                active={privacy === 'private'}
                onClick={() => setPrivacy('private')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label>Invite friends</Label>
              <span className="text-xs text-muted-foreground">{remaining} slots left</span>
            </div>

            {friends && friends.length > 0 ? (
              <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
                {friends.map((friend) => {
                  const checked = selected.includes(friend.id);
                  const disabled = !checked && remaining <= 0;
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setSelected((current) =>
                          checked ? current.filter((id) => id !== friend.id) : [...current, friend.id],
                        )
                      }
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                        checked ? 'bg-accent' : 'hover:bg-accent/60',
                        disabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <UserAvatar user={friend} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm">{friend.displayName}</span>
                      <span
                        className={cn(
                          'grid h-4 w-4 place-items-center rounded-full border',
                          checked
                            ? 'border-transparent bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white'
                            : 'border-border',
                        )}
                      >
                        {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Add friends first, then you can invite them here.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createGroup.isPending}>
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PrivacyOption({
  icon: Icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: typeof Globe;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
        active ? 'border-[#6366f1] bg-[#6366f1]/5' : 'border-border hover:bg-accent/50',
      )}
    >
      <Icon className={cn('h-4 w-4', active && 'text-[#6366f1]')} />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
