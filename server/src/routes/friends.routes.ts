import { Router } from 'express';
import * as friends from '../controllers/friends.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(friends.listFriends));
router.get('/requests', asyncHandler(friends.listRequests));
router.get('/blocked', asyncHandler(friends.listBlocked));
router.get('/status/:userId', asyncHandler(friends.getRelationship));
router.post('/request/:userId', asyncHandler(friends.sendRequest));
router.post('/accept/:requestId', asyncHandler(friends.acceptRequest));
router.post('/reject/:requestId', asyncHandler(friends.rejectRequest));
router.post('/block/:userId', asyncHandler(friends.blockUser));
router.post('/unblock/:userId', asyncHandler(friends.unblockUser));
router.delete('/:friendshipId', asyncHandler(friends.removeFriend));

export default router;
