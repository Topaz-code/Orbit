import { AlertCircle, Check, CheckCheck, Clock, CornerUpLeft, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn, mediaUrl } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RichText } from '@/components/feed/RichText';
import type { Message } from '@/types';

export function MessageBubble({
  message,
  grouped,
  showAvatar,
  isGroupChat,
  onReply,
  onDelete,
}: {
  message: Message;
  grouped: boolean;
  showAvatar: boolean;
  isGroupChat: boolean;
  onReply: (message: Message) => void;
  onDelete: (message: Message, scope: 'me' | 'all') => void;
}) {
  const own = message.isOwn;

  if (message.isDeleted) {
    return (
      <div className={cn('flex px-1', own ? 'justify-end' : 'justify-start')}>
        <p className="rounded-2xl bg-muted px-3 py-1.5 text-xs italic text-muted-foreground">
          This message was deleted
        </p>
      </div>
    );
  }

  return (
    <div className={cn('group flex items-end gap-2 px-1', own ? 'flex-row-reverse' : 'flex-row')}>
      <span className="w-7 shrink-0">
        {!own && showAvatar && message.sender ? <UserAvatar user={message.sender} size="xs" /> : null}
      </span>

      <div className={cn('flex max-w-[min(32rem,78%)] flex-col', own ? 'items-end' : 'items-start')}>
        {!own && isGroupChat && !grouped && message.sender ? (
          <span className="mb-0.5 pl-3 text-[11px] font-semibold text-[#6366f1] dark:text-[#a5b4fc]">
            {message.sender.displayName}
          </span>
        ) : null}

        <div
          className={cn(
            'relative rounded-2xl px-3 py-2 shadow-sm transition-opacity',
            own
              ? 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white'
              : 'bg-card text-card-foreground ring-1 ring-border',
            own ? (grouped ? 'rounded-tr-md' : 'rounded-br-md') : grouped ? 'rounded-tl-md' : 'rounded-bl-md',
            message.pending && 'opacity-70',
            message.failed && 'ring-2 ring-destructive',
          )}
        >
          {message.replyTo ? (
            <div
              className={cn(
                'mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs',
                own ? 'border-white/60 bg-white/15' : 'border-[#6366f1] bg-muted',
              )}
            >
              <p className={cn('font-semibold', own ? 'text-white/90' : 'text-[#6366f1]')}>
                {message.replyTo.senderName}
              </p>
              <p className={cn('line-clamp-2', own ? 'text-white/80' : 'text-muted-foreground')}>
                {message.replyTo.content || 'Attachment'}
              </p>
            </div>
          ) : null}

          {message.mediaUrl ? (
            <div className="mb-1 overflow-hidden rounded-lg">
              {message.mediaType === 'video' ? (
                <video src={mediaUrl(message.mediaUrl)} controls className="max-h-72 w-full rounded-lg" />
              ) : message.mediaType === 'audio' ? (
                <audio src={mediaUrl(message.mediaUrl)} controls className="w-56" />
              ) : (
                <a href={mediaUrl(message.mediaUrl)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={mediaUrl(message.mediaUrl)}
                    alt=""
                    loading="lazy"
                    className="max-h-72 w-full rounded-lg object-cover"
                  />
                </a>
              )}
            </div>
          ) : null}

          {message.content ? (
            <RichText
              text={message.content}
              className={cn(
                'whitespace-pre-wrap break-words text-sm leading-relaxed',
                own && '[&_a]:text-white [&_a]:underline',
              )}
            />
          ) : null}

          <span
            className={cn(
              'mt-0.5 flex items-center justify-end gap-1 text-[10px]',
              own ? 'text-white/70' : 'text-muted-foreground',
            )}
          >
            {format(new Date(message.createdAt), 'HH:mm')}
            {own ? <ReceiptIcon message={message} /> : null}
          </span>
        </div>

        {message.failed ? (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            Not delivered
          </span>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="mb-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 focus:opacity-100"
            aria-label="Message options"
          >
            <CornerUpLeft className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={own ? 'end' : 'start'} className="w-44">
          <DropdownMenuItem onSelect={() => onReply(message)}>
            <CornerUpLeft className="mr-2 h-4 w-4" />
            Reply
          </DropdownMenuItem>
          {own ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onDelete(message, 'me')}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete for me
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(message, 'all')}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete for everyone
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Clock while sending, single tick when stored, double tick once read. */
function ReceiptIcon({ message }: { message: Message }) {
  if (message.pending) return <Clock className="h-3 w-3" aria-label="Sending" />;
  if (message.failed) return <AlertCircle className="h-3 w-3" aria-label="Failed" />;
  if (message.isRead) return <CheckCheck className="h-3 w-3 text-[#7dd3fc]" aria-label="Read" />;
  return <Check className="h-3 w-3" aria-label="Sent" />;
}
