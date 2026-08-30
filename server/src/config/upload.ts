import crypto from 'node:crypto';
import path from 'node:path';
import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { UPLOADS_DIR, UPLOAD_SUBDIRS, ensureUploadDirs, type UploadCategory } from './paths.js';
import { env } from './env.js';
import { badRequest } from '../utils/errors.js';

ensureUploadDirs();

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
const AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
]);

export function mediaKind(mimetype: string): 'image' | 'video' | 'audio' | null {
  if (IMAGE_TYPES.has(mimetype)) return 'image';
  if (VIDEO_TYPES.has(mimetype)) return 'video';
  if (AUDIO_TYPES.has(mimetype)) return 'audio';
  return null;
}

function resolveCategory(req: Request): UploadCategory {
  const raw = String(req.query.category ?? req.body?.category ?? 'posts');
  return (UPLOAD_SUBDIRS as readonly string[]).includes(raw)
    ? (raw as UploadCategory)
    : 'posts';
}

const storage = multer.diskStorage({
  destination(req, _file, callback) {
    callback(null, path.join(UPLOADS_DIR, resolveCategory(req as Request)));
  },
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || guessExtension(file.mimetype);
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

function guessExtension(mimetype: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'audio/webm': '.weba',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
  };
  return map[mimetype] ?? '';
}

function fileFilter(_req: Request, file: Express.Multer.File, callback: FileFilterCallback): void {
  if (!mediaKind(file.mimetype)) {
    callback(badRequest(`Unsupported file type: ${file.mimetype}`));
    return;
  }
  callback(null, true);
}

/**
 * Multer enforces the larger (video) ceiling; `enforceSizeLimits` then applies the stricter
 * per-kind limits from the spec (10MB images, 50MB video) once the mimetype is known.
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Math.max(env.maxImageBytes, env.maxVideoBytes), files: 10 },
});

export function checkFileSize(file: Express.Multer.File): string | null {
  const kind = mediaKind(file.mimetype);
  if (kind === 'image' && file.size > env.maxImageBytes) {
    return `Images must be smaller than ${Math.round(env.maxImageBytes / 1024 / 1024)}MB`;
  }
  if ((kind === 'video' || kind === 'audio') && file.size > env.maxVideoBytes) {
    return `Videos must be smaller than ${Math.round(env.maxVideoBytes / 1024 / 1024)}MB`;
  }
  return null;
}

export function publicUrl(file: Express.Multer.File): string {
  const relative = path.relative(UPLOADS_DIR, file.path).split(path.sep).join('/');
  return `/uploads/${relative}`;
}
