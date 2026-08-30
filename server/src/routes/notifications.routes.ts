import { Router } from 'express';
import * as notifications from '../controllers/notifications.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(notifications.listNotifications));
router.get('/unread-count', asyncHandler(notifications.unreadCount));
router.put('/read-all', asyncHandler(notifications.markAllRead));
router.put('/:id/read', asyncHandler(notifications.markRead));
router.delete('/clear', asyncHandler(notifications.clearAll));
router.delete('/:id', asyncHandler(notifications.deleteNotification));

export default router;
