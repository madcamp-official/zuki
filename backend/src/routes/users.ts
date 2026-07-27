import { Router } from 'express';
import {
  addBookmark,
  listBookmarks,
  removeBookmark,
  setCategoryInterests,
} from '../controllers/usersController';
import { asyncHandler } from './asyncHandler';

const router = Router();

router.get('/me/bookmarks', asyncHandler(listBookmarks));
router.post('/me/bookmarks/:trendId', asyncHandler(addBookmark));
router.delete('/me/bookmarks/:trendId', asyncHandler(removeBookmark));
router.put('/me/category-interests', asyncHandler(setCategoryInterests));

export default router;
