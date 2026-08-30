import type { Request, Response } from 'express';
import { mediaKind, publicUrl } from '../config/upload.js';
import { badRequest } from '../utils/errors.js';

/** POST /api/upload — multipart upload; returns the public URL(s) under /uploads. */
export async function uploadFiles(req: Request, res: Response): Promise<void> {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...(req.files as Express.Multer.File[]));

  if (files.length === 0) throw badRequest('No file was uploaded');

  const items = files.map((file) => ({
    url: publicUrl(file),
    type: mediaKind(file.mimetype) ?? 'image',
    mimetype: file.mimetype,
    size: file.size,
    originalName: file.originalname,
  }));

  res.status(201).json({ items, url: items[0]?.url, type: items[0]?.type });
}
