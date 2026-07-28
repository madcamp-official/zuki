import { Router } from 'express';
import {
  addBookmark,
  getMyProfile,
  listBookmarks,
  removeBookmark,
  setCategoryInterests,
  updateMyProfile,
} from '../controllers/usersController';
import { requireAuth } from '../middlewares/auth';
import { asyncHandler } from './asyncHandler';

const router = Router();

// /api/users/* 는 전부 본인 데이터라 인증이 필수다
router.use(requireAuth);

router.get('/me', asyncHandler(getMyProfile));
router.patch('/me', asyncHandler(updateMyProfile));
router.get('/me/bookmarks', asyncHandler(listBookmarks));
router.post('/me/bookmarks/:trendId', asyncHandler(addBookmark));
router.delete('/me/bookmarks/:trendId', asyncHandler(removeBookmark));
router.put('/me/category-interests', asyncHandler(setCategoryInterests));

export default router;
