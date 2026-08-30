import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProfileUser } from '@/types';

const schema = z.object({
  displayName: z.string().trim().min(1, 'Tell people what to call you').max(60),
  bio: z.string().trim().max(300, 'Keep your bio under 300 characters'),
});

type FormValues = z.infer<typeof schema>;

export function EditProfileDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: ProfileUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: profile.displayName, bio: profile.bio },
  });

  useEffect(() => {
    if (open) reset({ displayName: profile.displayName, bio: profile.bio });
  }, [open, profile.displayName, profile.bio, reset]);

  const bio = watch('bio') ?? '';

  const onSubmit = (values: FormValues) => {
    updateProfile.mutate(values, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Change your photos from the camera buttons on your profile header.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              {...register('displayName')}
              error={Boolean(errors.displayName)}
              maxLength={60}
              autoComplete="name"
            />
            {errors.displayName ? (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{300 - bio.length}</span>
            </div>
            <Textarea
              id="bio"
              {...register('bio')}
              error={Boolean(errors.bio)}
              maxLength={300}
              rows={4}
              placeholder="Tell people a little about yourself"
            />
            {errors.bio ? <p className="text-xs text-destructive">{errors.bio.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateProfile.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
