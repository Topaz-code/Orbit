import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { verifyAccessToken } from '../config/auth.js';
import { unauthorized } from '../utils/errors.js';

/**
 * The subset of the user record attached to every authenticated request.
 *
 * Passport's types already declare `Request.user?: Express.User`, so we augment `Express.User`
 * rather than redeclaring `Request.user` — redeclaring it conflicts with @types/passport.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string;
      email: string;
      phone: string;
    }
  }
}

export type AuthenticatedUser = Express.User;

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const query = req.query.access_token;
  if (typeof query === 'string' && query) return query;
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized('Missing access token');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Session expired. Please sign in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        phone: true,
        tokenVersion: true,
      },
    });
    if (!user) throw unauthorized('Account no longer exists');
    if (user.tokenVersion !== payload.tokenVersion) {
      throw unauthorized('You have been signed out of all devices');
    }

    const { tokenVersion, ...rest } = user;
    req.user = rest;
    next();
  } catch (error) {
    next(error);
  }
}

/** Populates req.user when a valid token is present but never rejects the request. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        phone: true,
      },
    });
    if (user) req.user = user;
  } catch {
    /* ignore — treated as anonymous */
  }
  next();
}

export function currentUser(req: Request): AuthenticatedUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
