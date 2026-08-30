import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import postsRoutes from './posts.routes.js';
import commentsRoutes from './comments.routes.js';
import storiesRoutes from './stories.routes.js';
import conversationsRoutes from './conversations.routes.js';
import messagesRoutes from './messages.routes.js';
import groupsRoutes from './groups.routes.js';
import friendsRoutes from './friends.routes.js';
import notificationsRoutes from './notifications.routes.js';
import callsRoutes from './calls.routes.js';
import searchRoutes from './search.routes.js';
import uploadRoutes from './upload.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'orbit', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/posts', postsRoutes);
router.use('/comments', commentsRoutes);
router.use('/stories', storiesRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/messages', messagesRoutes);
router.use('/groups', groupsRoutes);
router.use('/friends', friendsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/calls', callsRoutes);
router.use('/search', searchRoutes);
router.use('/upload', uploadRoutes);

export default router;
