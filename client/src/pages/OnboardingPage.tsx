import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Check, PartyPopper, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useSuggestions, useSendFriendRequest } from '@/hooks/useFriends';
import { OrbitWordmark } from '@/components/shared/OrbitLogo';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageCropper } from '@/components/shared/ImageCropper';

const STEPS = ['Photo', 'About you', 'Find friends'] as const;

/** Three-step first-run flow; the final step marks the account onboarded. */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useUpdateProfile();
  const avatarUpload = useMediaUpload('avatars');
  const { data: suggestions } = useSuggestions();
  const sendRequest = useSendFriendRequest();

  const [step, setStep] = useState(0);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [invited, setInvited] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finish = () => {
    updateProfile.mutate(
      { bio: bio.trim(), isOnboarded: true },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  };

  const handleCropped = async (file: File) => {
    setCropFile(null);
    const uploaded = await avatarUpload.upload([file]);
    const first = uploaded[0];
    if (first) updateProfile.mutate({ avatarUrl: first.url });
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <OrbitWordmark />
        </div>

        <ol className="mb-8 flex items-center gap-2" aria-label="Onboarding progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors',
                  index < step
                    ? 'bg-[#22c55e] text-white'
                    : index === step
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white'
                      : 'bg-secondary text-muted-foreground',
                )}
              >
                {index < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-medium sm:block',
                  index === step ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
              {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>

        <div className="animate-fade-in-up space-y-6">
          {step === 0 ? (
            <>
              <header className="space-y-1.5 text-center">
                <h1 className="text-2xl font-bold">Add a profile photo</h1>
                <p className="text-sm text-muted-foreground">
                  Help your friends recognise you. You can change it any time.
                </p>
              </header>

              <div className="flex flex-col items-center gap-4">
                {user ? <UserAvatar user={user} size="3xl" className="ring-4 ring-border" /> : null}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) setCropFile(file);
                  }}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={avatarUpload.uploading}>
                  <Camera className="h-4 w-4" />
                  Choose a photo
                </Button>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <header className="space-y-1.5 text-center">
                <h1 className="text-2xl font-bold">Tell people about you</h1>
                <p className="text-sm text-muted-foreground">A short bio makes your profile feel like yours.</p>
              </header>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="bio">Bio</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{300 - bio.length}</span>
                </div>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={300}
                  rows={4}
                  placeholder="Film photography, bad puns, and a lot of coffee."
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <header className="space-y-1.5 text-center">
                <h1 className="text-2xl font-bold">Find your people</h1>
                <p className="text-sm text-muted-foreground">
                  Send a few friend requests so your feed is not empty.
                </p>
              </header>

              <ul className="space-y-1">
                {(suggestions ?? []).slice(0, 6).map((person) => {
                  const sent = invited.includes(person.id);
                  return (
                    <li
                      key={person.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                    >
                      <UserAvatar user={person} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{person.displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
                      </span>
                      <Button
                        size="sm"
                        variant={sent ? 'outline' : 'default'}
                        disabled={sent}
                        onClick={() => {
                          sendRequest.mutate(person.id);
                          setInvited((current) => [...current, person.id]);
                        }}
                      >
                        {sent ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Sent
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" />
                            Add
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
                {(suggestions ?? []).length === 0 ? (
                  <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    No suggestions yet — you can search for people once you are inside.
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}

          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="ghost" className="flex-1" onClick={() => setStep((current) => current - 1)}>
                Back
              </Button>
            ) : null}

            {step < STEPS.length - 1 ? (
              <>
                <Button variant="ghost" className="flex-1" onClick={finish} loading={updateProfile.isPending}>
                  Skip for now
                </Button>
                <Button className="flex-1" onClick={() => setStep((current) => current + 1)}>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button className="flex-1" size="lg" onClick={finish} loading={updateProfile.isPending}>
                <PartyPopper className="h-4 w-4" />
                Enter Orbit
              </Button>
            )}
          </div>
        </div>
      </div>

      <ImageCropper
        open={cropFile !== null}
        file={cropFile}
        aspect={1}
        circular
        title="Crop your photo"
        onCancel={() => setCropFile(null)}
        onCropped={(file) => void handleCropped(file)}
      />
    </div>
  );
}
