import { useState } from 'react';
import { EMOJI_GROUPS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Lightweight emoji palette — no external emoji library, just curated sets. */
export function EmojiPicker({
  onSelect,
  trigger,
  align = 'start',
}: {
  onSelect: (emoji: string) => void;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const [group, setGroup] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-[19rem] p-0">
        <div className="flex border-b border-border">
          {EMOJI_GROUPS.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setGroup(index)}
              className={cn(
                'flex-1 px-2 py-2 text-xs font-medium transition-colors',
                index === group
                  ? 'border-b-2 border-[#6366f1] text-[#6366f1]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2">
          {EMOJI_GROUPS[group]?.emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="grid h-8 w-8 place-items-center rounded-md text-lg transition-transform hover:scale-125 hover:bg-accent"
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
