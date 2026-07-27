import { Router } from 'express';
import { getTrendDetail, listCategories, listTrends } from '../controllers/trendsController';
import { asyncHandler } from './asyncHandler';

const router = Router();

router.get('/', asyncHandler(listTrends));
router.get('/:id', asyncHandler(getTrendDetail));

export const categoriesRouter = Router();
categoriesRouter.get('/', asyncHandler(listCategories));

export default router;
