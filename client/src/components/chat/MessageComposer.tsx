import { useRef, useState } from 'react';
import { Paperclip, Send, Smile, X } from 'lucide-react';
import { cn, mediaUrl } from '@/lib/utils';
import { useSendMessage, useTypingPublisher } from '@/hooks/useChat';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from '@/components/shared/EmojiPicker';
import type { Message } from '@/types';

export function MessageComposer({
  conversationId,
  replyTo,
  onCancelReply,
}: {
  conversationId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
}) {
  const sendMessage = useSendMessage(conversationId);
  const { notifyTyping, stopTyping } = useTypingPublisher(conversationId);
  const { upload, uploading } = useMediaUpload('messages');

  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<{ url: string; type: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (text.trim().length > 0 || attachment !== null) && !uploading;

  const submit = () => {
    if (!canSend) return;
    sendMessage.mutate({
      content: text.trim(),
      mediaUrl: attachment?.url ?? '',
      mediaType: attachment?.type ?? '',
      replyToId: replyTo?.id ?? null,
    });
    setText('');
    setAttachment(null);
    onCancelReply();
    stopTyping();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((current) => current + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(`${text.slice(0, start)}${emoji}${text.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <div className="shrink-0 border-t border-border bg-card p-2.5">
      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-[#6366f1] bg-muted px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#6366f1]">
              Replying to {replyTo.sender?.displayName ?? 'message'}
            </p>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {replyTo.content || 'Attachment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {attachment ? (
        <div className="relative mb-2 inline-block">
          {attachment.type === 'video' ? (
            <video src={mediaUrl(attachment.url)} className="h-20 rounded-lg" muted />
          ) : (
            <img src={mediaUrl(attachment.url)} alt="Attachment" className="h-20 rounded-lg object-cover" />
          )}
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-white"
            aria-label="Remove attachment"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          hidden
          onChange={async (event) => {
            const files = event.target.files;
            event.target.value = '';
            if (!files?.length) return;
            const uploaded = await upload(files);
            const first = uploaded[0];
            if (first) setAttachment({ url: first.url, type: first.type });
          }}
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Attach a file"
        >
          <Paperclip className={cn('h-5 w-5', uploading && 'animate-pulse')} />
        </Button>

        <EmojiPicker
          onSelect={insertEmoji}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-muted-foreground"
              aria-label="Insert emoji"
            >
              <Smile className="h-5 w-5" />
            </Button>
          }
        />

        <Textarea
          ref={textareaRef}
          value={text}
          autoResize
          rows={1}
          maxLength={4000}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value) notifyTyping();
            else stopTyping();
          }}
          onBlur={stopTyping}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message…"
          className="min-h-[40px] rounded-2xl bg-background py-2.5"
          aria-label="Write a message"
        />

        <Button
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
