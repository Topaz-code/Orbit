import type { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { forbidden, notFound } from '../utils/errors.js';
import { parseLimit } from '../utils/helpers.js';
import { serializeNotification } from '../services/notifications.service.js';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const limit = parseLimit(req.query.limit, 30, 100);
  const unreadOnly = req.query.unread === 'true';

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
      include: {
        actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  res.json({ items: items.map(serializeNotification), unreadCount });
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const count = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
  res.json({ unreadCount: count });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id as string },
  });
  if (!notification) throw notFound('That notification no longer exists');
  if (notification.userId !== user.id) throw forbidden('That notification is not yours');

  await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  const count = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
  res.json({ success: true, unreadCount: count });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true, unreadCount: 0 });
}

export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id as string },
  });
  if (!notification) throw notFound('That notification no longer exists');
  if (notification.userId !== user.id) throw forbidden('That notification is not yours');

  await prisma.notification.delete({ where: { id: notification.id } });
  res.json({ success: true });
}

export async function clearAll(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  res.json({ success: true });
}
