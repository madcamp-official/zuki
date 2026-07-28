import { RequestHandler, Router } from 'express';
import {
  createKeyword,
  createTrend,
  discoverKeywords,
  listKeywords,
  listRisingKeywords,
  publishTrend,
  triggerCollect,
} from '../controllers/adminController';
import { requireAdmin, requireAuth } from '../middlewares/auth';
import { asyncHandler } from './asyncHandler';

const router = Router();

/**
 * 관리자 API 보호.
 *
 * 왜 필요한가: 이 라우트들은 외부 API 할당량과 실제 비용을 소모한다.
 *   - POST /trends 는 imageUrl이 없으면 OpenAI로 이미지를 생성한다 (호출당 과금)
 *   - POST /keywords/discover 는 유튜브·네이버 API를 호출한다
 *   - POST /collect 는 수백 회의 외부 API 호출을 일으킨다
 * 배포된 서버는 URL만 알면 누구나 접근할 수 있으므로 열어두면 안 된다.
 *
 * ADMIN_AUTH_DISABLED=true 로 두면 인증을 건너뛴다. 로컬 개발 편의를 위한
 * 장치이며, 배포 환경에서는 절대 켜지 말 것.
 */
const authDisabled = process.env.ADMIN_AUTH_DISABLED === 'true';

if (authDisabled) {
  console.warn(
    '[admin] ADMIN_AUTH_DISABLED=true — 관리자 API가 인증 없이 열려 있습니다. 로컬 개발 전용 설정입니다.'
  );
}

/** 관리자 인증 가드. 라우터 전체가 아니라 라우트별로 붙인다 (아래 /collect 예외 때문) */
const adminGuard: RequestHandler[] = authDisabled ? [] : [requireAuth, requireAdmin];

router.post('/trends', ...adminGuard, asyncHandler(createTrend));
router.patch('/trends/:id/publish', ...adminGuard, asyncHandler(publishTrend));
router.post('/keywords', ...adminGuard, asyncHandler(createKeyword));
router.get('/keywords', ...adminGuard, asyncHandler(listKeywords));
// '/keywords/rising'은 '/keywords/:id' 같은 동적 라우트보다 먼저 선언해야 가려지지 않는다
router.get('/keywords/rising', ...adminGuard, asyncHandler(listRisingKeywords));
router.post('/keywords/discover', ...adminGuard, asyncHandler(discoverKeywords));

/**
 * /collect는 관리자 가드를 붙이지 않는다.
 * 외부 스케줄러(cron-job.org)가 매일 호출하는데, 스케줄러는 로그인 토큰을
 * 가질 수 없기 때문이다. 대신 COLLECT_SECRET 헤더로 보호하며,
 * 그 검사는 컨트롤러 안에서 한다.
 */
router.post('/collect', asyncHandler(triggerCollect));

export default router;
