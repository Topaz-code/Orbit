import { Router } from 'express';
import * as groups from '../controllers/groups.controller.js';
import * as posts from '../controllers/posts.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { addGroupMemberSchema, createGroupSchema, createPostSchema, updateGroupSchema } from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(groups.listMyGroups));
router.get('/discover', asyncHandler(groups.discoverGroups));
router.get('/invite/:code', asyncHandler(groups.getByInviteCode));
router.post('/', validate(createGroupSchema), asyncHandler(groups.createGroup));

router.get('/:id', asyncHandler(groups.getGroup));
router.put('/:id', validate(updateGroupSchema), asyncHandler(groups.updateGroup));
router.delete('/:id', asyncHandler(groups.deleteGroup));
router.post('/:id/join', asyncHandler(groups.joinGroup));
router.post('/:id/leave', asyncHandler(groups.leaveGroup));
router.get('/:id/members', asyncHandler(groups.listMembers));
router.post('/:id/members', validate(addGroupMemberSchema), asyncHandler(groups.addMember));
router.delete('/:id/members/:userId', asyncHandler(groups.removeMember));
router.put('/:id/members/:userId', asyncHandler(groups.updateMemberRole));
router.get('/:id/posts', asyncHandler(groups.listGroupPosts));
router.post('/:id/posts', validate(createPostSchema), asyncHandler(posts.createPost));

export default router;
