import { Router } from 'express';
import {
  createKeyword,
  createTrend,
  discoverKeywords,
  listKeywords,
  listRisingKeywords,
  publishTrend,
  triggerCollect,
} from '../controllers/adminController';
import { asyncHandler } from './asyncHandler';

const router = Router();

router.post('/trends', asyncHandler(createTrend));
router.patch('/trends/:id/publish', asyncHandler(publishTrend));
router.post('/keywords', asyncHandler(createKeyword));
router.get('/keywords', asyncHandler(listKeywords));
// '/keywords/rising'은 '/keywords/:id' 같은 동적 라우트보다 먼저 선언해야 가려지지 않는다
router.get('/keywords/rising', asyncHandler(listRisingKeywords));
router.post('/keywords/discover', asyncHandler(discoverKeywords));
router.post('/collect', asyncHandler(triggerCollect));

export default router;
