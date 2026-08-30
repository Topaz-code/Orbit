import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ban,
  Calendar,
  Camera,
  Check,
  Clock,
  MessageCircle,
  Pencil,
  Phone,
  UserMinus,
  UserPlus,
  Video,
} from 'lucide-react';
import { cn, compactNumber, joinedDate, lastSeenLabel, mediaUrl } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  useAcceptFriendRequest,
  useBlockUser,
  useFriendRequests,
  useRemoveFriend,
  useSendFriendRequest,
  useUnblockUser,
} from '@/hooks/useFriends';
import { useCreateConversation } from '@/hooks/useChat';
import { useCallEngine } from '@/hooks/useCall';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useUpdateProfile } from '@/hooks/useProfile';
import { usePresenceOf } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/shared/ImageCropper';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditProfileDialog } from './EditProfileDialog';
import { RichText } from '@/components/feed/RichText';
import type { ProfileUser } from '@/types';

export function ProfileHeader({ profile }: { profile: ProfileUser }) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const isSelf = profile.relationship === 'self' || profile.id === currentUser?.id;
  const online = usePresenceOf(profile.id, profile.isOnline);

  const [editOpen, setEditOpen] = useState(false);
  const [cropFile, setCropFile] = useState<{ file: File; kind: 'avatar' | 'cover' } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: requests } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const createConversation = useCreateConversation();
  const updateProfile = useUpdateProfile();
  const { startCall } = useCallEngine();
  const avatarUpload = useMediaUpload('avatars');
  const coverUpload = useMediaUpload('covers');

  const incomingRequestId = requests?.incoming.find((request) => request.user.id === profile.id)?.id;

  const openChat = () => {
    createConversation.mutate(
      { memberIds: [profile.id], type: 'direct' },
      { onSuccess: (data) => navigate(`/messages/${data.conversation.id}`) },
    );
  };

  const handleCropped = async (file: File, kind: 'avatar' | 'cover') => {
    const uploader = kind === 'avatar' ? avatarUpload : coverUpload;
    const uploaded = await uploader.upload([file]);
    const first = uploaded[0];
    if (!first) return;
    updateProfile.mutate(kind === 'avatar' ? { avatarUrl: first.url } : { coverUrl: first.url });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative h-40 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] sm:h-56">
        {profile.coverUrl ? (
          <img src={mediaUrl(profile.coverUrl)} alt="" className="h-full w-full object-cover" />
        ) : null}

        {isSelf ? (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) setCropFile({ file, kind: 'cover' });
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-3 right-3 gap-1.5 bg-black/50 text-white hover:bg-black/70"
              onClick={() => coverInputRef.current?.click()}
              loading={coverUpload.uploading}
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Edit cover</span>
            </Button>
          </>
        ) : null}
      </div>

      <div className="relative px-4 pb-4 sm:px-6">
        <div className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-16">
          <div className="relative">
            <UserAvatar
              user={{ ...profile, isOnline: online }}
              size="3xl"
              showStatus
              className="ring-4 ring-card"
            />
            {isSelf ? (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) setCropFile({ file, kind: 'avatar' });
                  }}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUpload.uploading}
                  className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white transition-transform hover:scale-110"
                  aria-label="Change profile photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{profile.displayName}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            {isSelf ? (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
            ) : (
              <RelationshipActions
                profile={profile}
                incomingRequestId={incomingRequestId}
                onAccept={() => incomingRequestId && acceptRequest.mutate(incomingRequestId)}
                onSend={() => sendRequest.mutate(profile.id)}
                onRemove={() => setConfirmRemove(true)}
                onUnblock={() => unblockUser.mutate(profile.id)}
                onBlock={() => setConfirmBlock(true)}
                pending={sendRequest.isPending || acceptRequest.isPending}
              />
            )}

            {!isSelf && profile.relationship !== 'blocked' && profile.relationship !== 'blocked_by' ? (
              <>
                <Button variant="outline" size="sm" onClick={openChat} loading={createConversation.isPending}>
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Message</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Voice call"
                  onClick={() => void startCall(profile, 'voice')}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Video call"
                  onClick={() => void startCall(profile, 'video')}
                >
                  <Video className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {profile.bio ? (
          <RichText text={profile.bio} className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" />
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Joined {joinedDate(profile.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {lastSeenLabel({ isOnline: online, lastSeen: profile.lastSeen })}
          </span>
        </div>

        <div className="mt-3 flex gap-5 border-t border-border pt-3 text-sm">
          <Stat label="Posts" value={profile.stats.posts} />
          <Stat label="Friends" value={profile.stats.friends} />
          <Stat label="Groups" value={profile.stats.groups} />
        </div>
      </div>

      <EditProfileDialog profile={profile} open={editOpen} onOpenChange={setEditOpen} />

      <ImageCropper
        open={cropFile !== null}
        file={cropFile?.file ?? null}
        aspect={cropFile?.kind === 'cover' ? 16 / 6 : 1}
        circular={cropFile?.kind === 'avatar'}
        title={cropFile?.kind === 'cover' ? 'Position your cover' : 'Crop your photo'}
        onCancel={() => setCropFile(null)}
        onCropped={(file) => {
          const kind = cropFile?.kind ?? 'avatar';
          setCropFile(null);
          void handleCropped(file, kind);
        }}
      />

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${profile.displayName}?`}
        description="You will no longer see each other's friends-only posts."
        confirmLabel="Remove friend"
        destructive
        loading={removeFriend.isPending}
        onConfirm={() => {
          if (profile.friendshipId) {
            removeFriend.mutate(profile.friendshipId, { onSuccess: () => setConfirmRemove(false) });
          }
        }}
      />

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={`Block ${profile.displayName}?`}
        description="They will not be able to message you, see your posts or find your profile."
        confirmLabel="Block"
        destructive
        loading={blockUser.isPending}
        onConfirm={() => blockUser.mutate(profile.id, { onSuccess: () => setConfirmBlock(false) })}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-bold">{compactNumber(value)}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function RelationshipActions({
  profile,
  incomingRequestId,
  onAccept,
  onSend,
  onRemove,
  onUnblock,
  onBlock,
  pending,
}: {
  profile: ProfileUser;
  incomingRequestId?: string;
  onAccept: () => void;
  onSend: () => void;
  onRemove: () => void;
  onUnblock: () => void;
  onBlock: () => void;
  pending: boolean;
}) {
  switch (profile.relationship) {
    case 'friends':
      return (
        <Button variant="outline" size="sm" onClick={onRemove}>
          <UserMinus className="h-4 w-4" />
          Friends
        </Button>
      );
    case 'request_sent':
      return (
        <Button variant="outline" size="sm" disabled>
          <Clock className="h-4 w-4" />
          Request sent
        </Button>
      );
    case 'request_received':
      return (
        <Button size="sm" onClick={onAccept} loading={pending} disabled={!incomingRequestId}>
          <Check className="h-4 w-4" />
          Accept request
        </Button>
      );
    case 'blocked':
      return (
        <Button variant="outline" size="sm" onClick={onUnblock}>
          <Ban className="h-4 w-4" />
          Unblock
        </Button>
      );
    case 'blocked_by':
      return (
        <Button variant="outline" size="sm" disabled>
          <Ban className="h-4 w-4" />
          Unavailable
        </Button>
      );
    default:
      return (
        <div className={cn('flex gap-2')}>
          <Button size="sm" onClick={onSend} loading={pending}>
            <UserPlus className="h-4 w-4" />
            Add friend
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onBlock} aria-label="Block user">
            <Ban className="h-4 w-4" />
          </Button>
        </div>
      );
  }
}
