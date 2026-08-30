import { Router } from 'express';
import * as upload from '../controllers/upload.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { enforceFileLimits } from '../middleware/upload.middleware.js';
import { upload as multerUpload } from '../config/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.post('/', multerUpload.array('files', 10), enforceFileLimits, asyncHandler(upload.uploadFiles));
router.post('/single', multerUpload.single('file'), enforceFileLimits, asyncHandler(upload.uploadFiles));

export default router;
