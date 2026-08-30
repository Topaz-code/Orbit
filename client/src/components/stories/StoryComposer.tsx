import { useRef, useState } from 'react';
import { Image as ImageIcon, Type, Upload, X } from 'lucide-react';
import { cn, mediaUrl } from '@/lib/utils';
import { useCreateStory } from '@/hooks/useStories';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StoryOverlay } from '@/types';

const OVERLAY_COLORS = ['#ffffff', '#111827', '#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

/** Upload an image or video, add an optional text overlay, then post a 24-hour story. */
export function StoryComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { upload, uploading } = useMediaUpload('stories');
  const createStory = useCreateStory();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [media, setMedia] = useState<{ url: string; type: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [overlay, setOverlay] = useState<StoryOverlay>({ text: '', color: '#ffffff', fontSize: 28, x: 50, y: 50 });
  const [showOverlayControls, setShowOverlayControls] = useState(false);

  const reset = () => {
    setMedia(null);
    setCaption('');
    setOverlay({ text: '', color: '#ffffff', fontSize: 28, x: 50, y: 50 });
    setShowOverlayControls(false);
  };

  const handleFile = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded = await upload(files);
    const first = uploaded[0];
    if (first) setMedia({ url: first.url, type: first.type });
  };

  const submit = () => {
    if (!media) return;
    createStory.mutate(
      {
        mediaUrl: media.url,
        mediaType: media.type === 'video' ? 'video' : 'image',
        caption: caption.trim(),
        overlay: overlay.text?.trim() ? overlay : undefined,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to your story</DialogTitle>
          <DialogDescription>Your story disappears automatically after 24 hours.</DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(event) => {
            void handleFile(event.target.files);
            event.target.value = '';
          }}
        />

        {!media ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[9/16] max-h-80 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-accent/40 disabled:opacity-60"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#6366f1]/15 to-[#8b5cf6]/15">
              {uploading ? (
                <Upload className="h-6 w-6 animate-pulse text-primary" />
              ) : (
                <ImageIcon className="h-6 w-6 text-primary" />
              )}
            </span>
            <span className="text-sm font-medium">{uploading ? 'Uploading…' : 'Choose a photo or video'}</span>
            <span className="text-xs text-muted-foreground">Images up to 10 MB · Videos up to 50 MB</span>
          </button>
        ) : (
          <div className="relative aspect-[9/16] max-h-80 w-full overflow-hidden rounded-xl bg-black">
            {media.type === 'video' ? (
              <video src={mediaUrl(media.url)} className="h-full w-full object-contain" autoPlay muted loop playsInline />
            ) : (
              <img src={mediaUrl(media.url)} alt="Story preview" className="h-full w-full object-contain" />
            )}

            {overlay.text ? (
              <p
                className="pointer-events-none absolute max-w-[85%] text-center font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                style={{
                  color: overlay.color,
                  fontSize: `${overlay.fontSize}px`,
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {overlay.text}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setMedia(null)}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              aria-label="Remove media"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {media ? (
          <div className="space-y-3">
            <Input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Add a caption (optional)"
              maxLength={300}
              aria-label="Story caption"
            />

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowOverlayControls((current) => !current)}
            >
              <Type className="h-4 w-4" />
              {showOverlayControls ? 'Hide text overlay' : 'Add text on the image'}
            </Button>

            {showOverlayControls ? (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <Input
                  value={overlay.text ?? ''}
                  onChange={(event) => setOverlay((current) => ({ ...current, text: event.target.value }))}
                  placeholder="Overlay text"
                  maxLength={200}
                  aria-label="Overlay text"
                />

                <div className="flex items-center gap-2">
                  <Label className="w-16 text-xs">Colour</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {OVERLAY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setOverlay((current) => ({ ...current, color }))}
                        style={{ backgroundColor: color }}
                        className={cn(
                          'h-6 w-6 rounded-full border border-border transition-transform hover:scale-110',
                          overlay.color === color && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                        )}
                        aria-label={`Use ${color}`}
                      />
                    ))}
                  </div>
                </div>

                <SliderRow
                  label="Size"
                  min={12}
                  max={72}
                  value={overlay.fontSize ?? 28}
                  onChange={(fontSize) => setOverlay((current) => ({ ...current, fontSize }))}
                />
                <SliderRow
                  label="Across"
                  min={5}
                  max={95}
                  value={overlay.x ?? 50}
                  onChange={(x) => setOverlay((current) => ({ ...current, x }))}
                />
                <SliderRow
                  label="Down"
                  min={5}
                  max={95}
                  value={overlay.y ?? 50}
                  onChange={(y) => setOverlay((current) => ({ ...current, y }))}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!media} loading={createStory.isPending}>
            Share story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SliderRow({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-16 text-xs">{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-[#6366f1]"
        aria-label={label}
      />
      <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}
