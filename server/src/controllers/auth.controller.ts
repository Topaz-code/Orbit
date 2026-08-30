import type { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../config/auth.js';
import { badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';
import { daysFromNow, normalizePhone, randomToken } from '../utils/helpers.js';
import { generateAvatar, generateCover } from '../utils/placeholder.js';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PRIVACY, toSelfUser } from '../services/serialize.js';
import { currentUser } from '../middleware/auth.middleware.js';
import type {
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
} from '../validators/index.js';
import type { z } from 'zod';

async function issueTokens(
  user: { id: string; username: string; tokenVersion: number },
  rememberMe: boolean,
) {
  const accessToken = signAccessToken(
    { sub: user.id, username: user.username, tokenVersion: user.tokenVersion },
    rememberMe,
  );
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: daysFromNow(env.refreshTokenTtlDays),
    },
  });
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof registerSchema>;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: body.username }, { email: body.email }, { phone: body.phone }],
    },
    select: { username: true, email: true, phone: true },
  });
  if (existing) {
    if (existing.username === body.username) throw conflict('That username is taken');
    if (existing.email === body.email) throw conflict('That email is already registered');
    throw conflict('That phone number is already registered');
  }

  const passwordHash = await hashPassword(body.password);
  const securityAnswerHash = body.securityAnswer
    ? await hashPassword(body.securityAnswer.toLowerCase())
    : '';

  const user = await prisma.user.create({
    data: {
      username: body.username,
      phone: body.phone,
      email: body.email,
      passwordHash,
      displayName: body.displayName,
      avatarUrl: generateAvatar(body.username, body.displayName),
      coverUrl: generateCover(body.username),
      securityQuestion: body.securityQuestion ?? '',
      securityAnswerHash,
      privacySettings: JSON.stringify(DEFAULT_PRIVACY),
      notificationSettings: JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS),
    },
  });

  const tokens = await issueTokens(user, false);
  res.status(201).json({ user: toSelfUser(user), ...tokens });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof loginSchema>;
  const value = body.identifier.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: value.toLowerCase().replace(/^@/, '') },
        { email: value.toLowerCase() },
        { phone: normalizePhone(value) },
      ],
    },
  });
  if (!user) throw unauthorized('No account matches those details');

  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) throw unauthorized('Incorrect password');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeen: new Date(), isOnline: true },
  });

  const tokens = await issueTokens(user, body.rememberMe ?? false);
  res.json({ user: toSelfUser(user), ...tokens });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Your session expired. Please sign in again.');
  }

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    throw unauthorized('Your session expired. Please sign in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw unauthorized('Account no longer exists');

  // Rotate: the presented refresh token is consumed and replaced.
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  const tokens = await issueTokens(user, false);

  res.json({ user: toSelfUser(user), ...tokens });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
  const allDevices = Boolean((req.body as { allDevices?: boolean })?.allDevices);

  if (allDevices && req.user) {
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: req.user.id } }),
      prisma.user.update({
        where: { id: req.user.id },
        data: { tokenVersion: { increment: 1 }, isOnline: false, lastSeen: new Date() },
      }),
    ]);
  } else if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  if (req.user && !allDevices) {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { isOnline: false, lastSeen: new Date() },
    });
  }

  res.json({ success: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const auth = currentUser(req);
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) throw notFound('Account not found');
  res.json({ user: toSelfUser(user) });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body as z.infer<typeof forgotPasswordSchema>;
  const value = identifier.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: value.toLowerCase().replace(/^@/, '') },
        { email: value.toLowerCase() },
        { phone: normalizePhone(value) },
      ],
    },
    select: { securityQuestion: true, securityAnswerHash: true },
  });

  // Always 200 so the endpoint cannot be used to enumerate accounts.
  res.json({
    hasAccount: Boolean(user?.securityAnswerHash),
    securityQuestion: user?.securityAnswerHash ? user.securityQuestion : '',
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof resetPasswordSchema>;
  const value = body.identifier.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: value.toLowerCase().replace(/^@/, '') },
        { email: value.toLowerCase() },
        { phone: normalizePhone(value) },
      ],
    },
  });
  if (!user || !user.securityAnswerHash) {
    throw badRequest('We could not verify that account');
  }

  const ok = await verifyPassword(body.securityAnswer.toLowerCase(), user.securityAnswerHash);
  if (!ok) throw badRequest('That answer does not match our records');

  const passwordHash = await hashPassword(body.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  res.json({ success: true, message: 'Password updated. Please sign in.' });
}

export async function checkAvailability(req: Request, res: Response): Promise<void> {
  const username = String(req.query.username ?? '').toLowerCase();
  if (!username) {
    res.json({ available: false });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  res.json({ available: !existing });
}

export { randomToken };
