import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(controller.register));
router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(controller.refresh));
router.post('/logout', optionalAuth, asyncHandler(controller.logout));
router.get('/me', requireAuth, asyncHandler(controller.me));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(controller.forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(controller.resetPassword));
router.get('/check-username', asyncHandler(controller.checkAvailability));

export default router;
