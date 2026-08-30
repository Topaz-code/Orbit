import { Router } from 'express';
import * as calls from '../controllers/calls.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { createCallSchema, updateCallSchema } from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/history', asyncHandler(calls.listHistory));
router.post('/', validate(createCallSchema), asyncHandler(calls.startCall));
router.get('/:id', asyncHandler(calls.getCall));
router.put('/:id', validate(updateCallSchema), asyncHandler(calls.updateCall));

export default router;
