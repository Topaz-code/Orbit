import { Router } from 'express';
import * as conversations from '../controllers/conversations.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.delete('/:id', asyncHandler(conversations.deleteMessage));

export default router;
