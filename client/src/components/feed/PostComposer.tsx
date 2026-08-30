import { useRef, useState } from 'react';
import { Image as ImageIcon, Link2, Smile, Video, X } from 'lucide-react';
import { cn, formatBytes, mediaUrl } from '@/lib/utils';
import { api } from '@/lib/api';
import { VISIBILITY_OPTIONS } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useCreatePost } from '@/hooks/usePosts';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { toast } from '@/stores/notificationStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/avatar';
import { EmojiPicker } from '@/components/shared/EmojiPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LinkPreview } from './LinkPreview';
import type { LinkPreviewData, PostVisibility } from '@/types';

const MAX_LENGTH = 5000;

interface Attachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

export function PostComposer({ groupId, className }: { groupId?: string; className?: string }) {
  const currentUser = useAuthStore((state) => state.user);
  const createPost = useCreatePost();
  const { upload, uploading } = useMediaUpload(groupId ? 'groups' : 'posts');

  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dismissedPreview, setDismissedPreview] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewedUrl = useRef<string>('');

  const canSubmit = (text.trim().length > 0 || attachments.length > 0) && !createPost.isPending && !uploading;
  const remaining = MAX_LENGTH - text.length;

  /** Looks up metadata for the first URL typed, debounced by the blur/idle callers. */
  const resolveLinkPreview = async (value: string) => {
    if (dismissedPreview) return;
    const match = value.match(/https?:\/\/[^\s]+/);
    const url = match?.[0];
    if (!url || url === previewedUrl.current) return;

    previewedUrl.current = url;
    setPreviewLoading(true);
    try {
      const response = await api.post<{ preview: LinkPreviewData | null }>('/posts/link-preview', { url });
      setPreview(response.data.preview);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (attachments.length + files.length > 4) {
      toast.error('Too many attachments', 'A post can hold up to 4 files.');
      return;
    }
    const uploaded = await upload(files);
    setAttachments((current) => [
      ...current,
      ...uploaded.map((item, index) => ({
        url: item.url,
        type: item.type,
        name: files[index]?.name ?? 'attachment',
        size: files[index]?.size ?? 0,
      })),
    ]);
  };

  const submit = () => {
    if (!canSubmit) return;
    createPost.mutate(
      {
        contentText: text.trim(),
        mediaUrl: attachments.map((item) => item.url).join(','),
        mediaType: attachments[0]?.type ?? '',
        linkUrl: preview?.url ?? '',
        visibility: groupId ? 'friends' : visibility,
        groupId,
      },
      {
        onSuccess: () => {
          setText('');
          setAttachments([]);
          setPreview(null);
          setDismissedPreview(false);
          previewedUrl.current = '';
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
        },
      },
    );
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((current) => current + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const selectedVisibility = VISIBILITY_OPTIONS.find((option) => option.value === visibility) ?? VISIBILITY_OPTIONS[0]!;
  const VisibilityIcon = selectedVisibility.icon;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex gap-3">
        {currentUser ? <UserAvatar user={currentUser} /> : null}

        <div className="min-w-0 flex-1 space-y-3">
          <Textarea
            ref={textareaRef}
            value={text}
            autoResize
            rows={2}
            maxLength={MAX_LENGTH}
            onChange={(event) => setText(event.target.value)}
            onBlur={(event) => void resolveLinkPreview(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={groupId ? 'Share something with the group…' : "What's happening in your orbit?"}
            className="min-h-[60px] resize-none border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0"
            aria-label="Write a post"
          />

          {attachments.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {attachments.map((item, index) => (
                <div key={`${item.url}-${index}`} className="group relative overflow-hidden rounded-lg border border-border">
                  {item.type === 'video' ? (
                    <video src={mediaUrl(item.url)} className="aspect-square w-full object-cover" muted />
                  ) : (
                    <img src={mediaUrl(item.url)} alt={item.name} className="aspect-square w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[10px] text-white">
                    {formatBytes(item.size)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {previewLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
          ) : preview ? (
            <div className="relative">
              <LinkPreview preview={preview} />
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setDismissedPreview(true);
                }}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                aria-label="Remove link preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1 border-t border-border pt-3">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = '';
              }}
            />

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
            >
              <ImageIcon className="h-4 w-4 text-[#22c55e]" />
              <span className="hidden sm:inline">Photo</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => videoInputRef.current?.click()}
              disabled={uploading}
            >
              <Video className="h-4 w-4 text-[#ef4444]" />
              <span className="hidden sm:inline">Video</span>
            </Button>

            <EmojiPicker
              onSelect={insertEmoji}
              trigger={
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Smile className="h-4 w-4 text-[#f59e0b]" />
                  <span className="hidden sm:inline">Emoji</span>
                </Button>
              }
            />

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => void resolveLinkPreview(text)}
              disabled={previewLoading || !/https?:\/\//.test(text)}
            >
              <Link2 className="h-4 w-4 text-[#06b6d4]" />
              <span className="hidden sm:inline">Link</span>
            </Button>

            <div className="ml-auto flex items-center gap-2">
              {text.length > MAX_LENGTH - 500 ? (
                <span className={cn('text-xs tabular-nums', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {remaining}
                </span>
              ) : null}

              {!groupId ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <VisibilityIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{selectedVisibility.label}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {VISIBILITY_OPTIONS.map((option) => {
                      const OptionIcon = option.icon;
                      return (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={() => setVisibility(option.value)}
                          className={cn(option.value === visibility && 'bg-accent')}
                        >
                          <OptionIcon className="mr-2 h-4 w-4" />
                          <span className="flex flex-col">
                            <span className="text-sm font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <Button size="sm" onClick={submit} disabled={!canSubmit} loading={createPost.isPending || uploading}>
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
