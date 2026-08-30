import { Router } from 'express';
import * as conversations from '../controllers/conversations.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createConversationSchema, createMessageSchema } from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(conversations.listConversations));
router.post('/', validate(createConversationSchema), asyncHandler(conversations.createConversation));
router.get('/:id', asyncHandler(conversations.getConversation));
router.get('/:id/messages', asyncHandler(conversations.listMessages));
router.post('/:id/messages', validate(createMessageSchema), asyncHandler(conversations.sendMessage));
router.put('/:id/read', asyncHandler(conversations.markRead));
router.post('/:id/members', asyncHandler(conversations.addMember));
router.post('/:id/leave', asyncHandler(conversations.leaveConversation));

export default router;
