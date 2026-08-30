import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors.js';
import { env } from '../config/env.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Please check the highlighted fields',
        fields: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large. Images max 10MB, video max 50MB.'
        : error.message;
    res.status(413).json({ error: { code: error.code, message } });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  const err = error as Error & { code?: string };
  if (err?.code === 'P2002') {
    res.status(409).json({
      error: { code: 'conflict', message: 'That value is already taken' },
    });
    return;
  }
  if (err?.code === 'P2025') {
    res.status(404).json({ error: { code: 'not_found', message: 'Record not found' } });
    return;
  }

  console.error('[orbit] Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on the server',
      ...(env.isProduction ? {} : { detail: err?.message, stack: err?.stack }),
    },
  });
}
