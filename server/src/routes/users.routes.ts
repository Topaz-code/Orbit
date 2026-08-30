import { Router } from 'express';
import * as users from '../controllers/users.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { changePasswordSchema, updateUserSchema } from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/search', optionalAuth, asyncHandler(users.searchUsers));
router.get('/suggestions', requireAuth, asyncHandler(users.suggestions));
router.get('/me/export', requireAuth, asyncHandler(users.exportData));
router.post('/me/password', requireAuth, validate(changePasswordSchema), asyncHandler(users.changePassword));
router.delete('/me', requireAuth, asyncHandler(users.deleteAccount));

router.get('/:id', optionalAuth, asyncHandler(users.getUser));
router.put('/:id', requireAuth, validate(updateUserSchema), asyncHandler(users.updateUser));
router.get('/:id/posts', optionalAuth, asyncHandler(users.listUserPosts));
router.get('/:id/media', optionalAuth, asyncHandler(users.listUserMedia));
router.get('/:id/friends', optionalAuth, asyncHandler(users.listUserFriends));
router.get('/:id/groups', optionalAuth, asyncHandler(users.listUserGroups));

export default router;
