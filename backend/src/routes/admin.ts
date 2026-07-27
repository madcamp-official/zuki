import { Router } from 'express';
import { createTrend, publishTrend } from '../controllers/adminController';
import { asyncHandler } from './asyncHandler';

const router = Router();

router.post('/trends', asyncHandler(createTrend));
router.patch('/trends/:id/publish', asyncHandler(publishTrend));

export default router;
