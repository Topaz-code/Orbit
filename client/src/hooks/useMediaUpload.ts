import { useCallback, useState } from 'react';
import { uploadFiles } from '@/lib/api';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '@/lib/constants';
import { formatBytes } from '@/lib/utils';
import { toast } from '@/stores/notificationStore';

type Category = 'avatars' | 'covers' | 'posts' | 'stories' | 'messages' | 'groups';

/** Validates size/type client-side before hitting the API, and reports progress state. */
export function useMediaUpload(category: Category = 'posts') {
  const [uploading, setUploading] = useState(false);

  const validate = useCallback((file: File): string | null => {
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage && !isAudio) return `${file.name} is not an image or video`;
    const limit = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > limit) {
      return `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(limit)}`;
    }
    return null;
  }, []);

  const upload = useCallback(
    async (files: File[] | FileList): Promise<Array<{ url: string; type: string }>> => {
      const list = Array.from(files);
      if (list.length === 0) return [];

      for (const file of list) {
        const problem = validate(file);
        if (problem) {
          toast.error('Upload blocked', problem);
          return [];
        }
      }

      setUploading(true);
      try {
        return await uploadFiles(list, category);
      } catch {
        toast.error('Upload failed', 'Please try again.');
        return [];
      } finally {
        setUploading(false);
      }
    },
    [category, validate],
  );

  return { upload, uploading, validate };
}
