import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import { checkFileSize } from '../config/upload.js';
import { badRequest } from '../utils/errors.js';

/**
 * Applies the stricter per-mimetype size limits after multer has written the file, deleting
 * anything that violates them so oversized uploads never linger on disk.
 */
export function enforceFileLimits(req: Request, _res: Response, next: NextFunction): void {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...(req.files as Express.Multer.File[]));
  else if (req.files && typeof req.files === 'object') {
    for (const group of Object.values(req.files as Record<string, Express.Multer.File[]>)) {
      files.push(...group);
    }
  }

  for (const file of files) {
    const problem = checkFileSize(file);
    if (problem) {
      for (const f of files) {
        try {
          fs.rmSync(f.path, { force: true });
        } catch {
          /* best effort */
        }
      }
      next(badRequest(problem));
      return;
    }
  }
  next();
}
