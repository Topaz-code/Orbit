import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImageCropperProps {
  open: boolean;
  file: File | null;
  aspect?: number;
  circular?: boolean;
  title?: string;
  onCancel: () => void;
  onCropped: (file: File) => void;
}

/**
 * Canvas-based cropper — drag to reposition, slider to zoom. Implemented directly rather than
 * pulling in a cropping library so the client stays dependency-light.
 */
export function ImageCropper({
  open,
  file,
  aspect = 1,
  circular = false,
  title = 'Adjust your photo',
  onCancel,
  onCropped,
}: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageSrc('');
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePointerDown = (event: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    setOffset({ x: event.clientX - dragStart.current.x, y: event.clientY - dragStart.current.y });
  };

  const handlePointerUp = () => setDragging(false);

  const handleSave = useCallback(async () => {
    const image = imageRef.current;
    if (!image || !file) return;
    setSaving(true);

    const viewportWidth = 320;
    const viewportHeight = viewportWidth / aspect;
    const outputWidth = circular ? 512 : 1200;
    const outputHeight = Math.round(outputWidth / aspect);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setSaving(false);
      return;
    }

    // Reproduce the on-screen transform at output resolution.
    const scaleRatio = outputWidth / viewportWidth;
    const baseScale = Math.max(viewportWidth / image.naturalWidth, viewportHeight / image.naturalHeight);
    const drawScale = baseScale * zoom * scaleRatio;
    const drawWidth = image.naturalWidth * drawScale;
    const drawHeight = image.naturalHeight * drawScale;
    const dx = (outputWidth - drawWidth) / 2 + offset.x * scaleRatio;
    const dy = (outputHeight - drawHeight) / 2 + offset.y * scaleRatio;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (!blob) return;
        onCropped(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }, [aspect, circular, file, offset, onCropped, zoom]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag to reposition, then zoom to frame it.</DialogDescription>
        </DialogHeader>

        <div
          className="relative mx-auto touch-none overflow-hidden bg-slate-900"
          style={{
            width: 320,
            height: 320 / aspect,
            borderRadius: circular ? '9999px' : '0.75rem',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {imageSrc ? (
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                width: 320,
                height: 'auto',
                minHeight: 320 / aspect,
                objectFit: 'cover',
                cursor: dragging ? 'grabbing' : 'grab',
              }}
            />
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(1, z - 0.1))}>
            <Minus />
          </Button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            aria-label="Zoom"
          />
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            title="Reset"
          >
            <RotateCcw />
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Use photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
