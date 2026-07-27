import { Router } from 'express';
import {
  createKeyword,
  createTrend,
  listKeywords,
  publishTrend,
  triggerCollect,
} from '../controllers/adminController';
import { asyncHandler } from './asyncHandler';

const router = Router();

router.post('/trends', asyncHandler(createTrend));
router.patch('/trends/:id/publish', asyncHandler(publishTrend));
router.post('/keywords', asyncHandler(createKeyword));
router.get('/keywords', asyncHandler(listKeywords));
router.post('/collect', asyncHandler(triggerCollect));

export default router;
