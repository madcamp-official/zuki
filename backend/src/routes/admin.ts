import { RequestHandler, Router } from 'express';
import {
  createKeyword,
  createTrend,
  discoverKeywords,
  getPipeline,
  listKeywords,
  listRisingKeywords,
  publishTrend,
  triggerAutoTrends,
  triggerCollect,
  triggerPipeline,
} from '../controllers/adminController';
import { requireAdmin, requireAuth, requireSecretOrAdmin } from '../middlewares/auth';
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
// '/trends/auto-refresh'는 '/trends/:id/publish'보다 먼저 선언해야 가려지지 않는다.
//
// 아래 /pipeline이 이 단계를 포함하므로 관리자 화면에서는 더 이상 직접 부르지 않는다.
// 다만 "카드 갱신만" 따로 돌리고 싶을 때가 있어 엔드포인트는 남겨둔다.
router.post('/trends/auto-refresh', ...adminGuard, asyncHandler(triggerAutoTrends));
router.patch('/trends/:id/publish', ...adminGuard, asyncHandler(publishTrend));
router.post('/keywords', ...adminGuard, asyncHandler(createKeyword));
router.get('/keywords', ...adminGuard, asyncHandler(listKeywords));
// '/keywords/rising'은 '/keywords/:id' 같은 동적 라우트보다 먼저 선언해야 가려지지 않는다
router.get('/keywords/rising', ...adminGuard, asyncHandler(listRisingKeywords));
// 마찬가지로 /pipeline에 포함된 단계. "발굴만" 따로 돌릴 때를 위해 남겨둔다
router.post('/keywords/discover', ...adminGuard, asyncHandler(discoverKeywords));

/**
 * 배치 실행 API는 다른 가드를 쓴다.
 *
 * 호출자가 둘로 갈리기 때문이다. 외부 스케줄러(cron-job.org)는 로그인할 수
 * 없으니 x-collect-secret 헤더를 쓰고, 데모 페이지의 관리자는 이미 로그인해
 * 있으니 Bearer 토큰을 쓴다. requireSecretOrAdmin이 둘 다 받는다.
 *
 * GET /pipeline은 진행 상황 조회라 부작용이 없어 열어둔다.
 */
const batchGuard: RequestHandler[] = authDisabled ? [] : [requireSecretOrAdmin];

router.post('/collect', ...batchGuard, asyncHandler(triggerCollect));
router.post('/pipeline', ...batchGuard, asyncHandler(triggerPipeline));
router.get('/pipeline', asyncHandler(getPipeline));

export default router;
