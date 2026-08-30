import { Router } from 'express';
import * as posts from '../controllers/posts.controller.js';
import * as comments from '../controllers/comments.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  createCommentSchema,
  createPostSchema,
  linkPreviewSchema,
  updatePostSchema,
} from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(posts.listFeed));
router.get('/explore', optionalAuth, asyncHandler(posts.listExplore));
router.get('/bookmarks', requireAuth, asyncHandler(posts.listBookmarks));
router.post('/link-preview', requireAuth, validate(linkPreviewSchema), asyncHandler(posts.previewLink));

router.post('/', requireAuth, validate(createPostSchema), asyncHandler(posts.createPost));
router.get('/:id', optionalAuth, asyncHandler(posts.getPost));
router.put('/:id', requireAuth, validate(updatePostSchema), asyncHandler(posts.updatePost));
router.delete('/:id', requireAuth, asyncHandler(posts.deletePost));

router.post('/:id/like', requireAuth, asyncHandler(posts.likePost));
router.delete('/:id/like', requireAuth, asyncHandler(posts.unlikePost));
router.get('/:id/likes', requireAuth, asyncHandler(posts.listLikes));
router.post('/:id/bookmark', requireAuth, asyncHandler(posts.toggleBookmark));
router.post('/:id/share', requireAuth, asyncHandler(posts.sharePost));

router.get('/:id/comments', optionalAuth, asyncHandler(comments.listComments));
router.post(
  '/:id/comments',
  requireAuth,
  validate(createCommentSchema),
  asyncHandler(comments.createComment),
);

export default router;
