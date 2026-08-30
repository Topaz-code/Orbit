import { Router } from 'express';
import * as stories from '../controllers/stories.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createStorySchema } from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(stories.listStories));
router.post('/', validate(createStorySchema), asyncHandler(stories.createStory));
router.get('/:id', asyncHandler(stories.getStory));
router.delete('/:id', asyncHandler(stories.deleteStory));
router.post('/:id/view', asyncHandler(stories.viewStory));
router.post('/:id/reply', asyncHandler(stories.replyToStory));

export default router;
