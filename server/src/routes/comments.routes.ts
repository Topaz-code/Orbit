import { Router } from 'express';
import * as comments from '../controllers/comments.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { updateCommentSchema } from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.put('/:id', validate(updateCommentSchema), asyncHandler(comments.updateComment));
router.delete('/:id', asyncHandler(comments.deleteComment));

export default router;
