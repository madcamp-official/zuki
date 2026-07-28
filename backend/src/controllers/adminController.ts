import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';
import { runDailyCollect } from '../jobs/dailyCollect';

/**
 * POST /api/admin/trends
 * 에디터 수동 큐레이션 입력 (기획서 11-4 ③, source: 'editor')
 * MVP 단계에서는 별도 관리자 화면 대신 이 API를 Postman/스크립트로 직접 호출해도 됨
 * (17번 "다음 논의가 필요한 사항" - 관리자 화면 별도 개발 여부 미정)
 */
export async function createTrend(req: Request, res: Response) {
  const { title, summary, categoryId, reason, imageUrl, regionScope, createdBy } = req.body;

  if (!title || !categoryId) {
    throw new ApiError(400, 'title, categoryId는 필수입니다.');
  }

  const [trend] = await query(
    `INSERT INTO trends (title, summary, category_id, reason, image_url, region_scope, primary_source, created_by)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'nationwide'), 'editor', $7)
     RETURNING id, title, status, is_published, created_at`,
    [title, summary ?? null, categoryId, reason ?? null, imageUrl ?? null, regionScope ?? null, createdBy ?? null]
  );

  res.status(201).json({ trend });
}

/**
 * PATCH /api/admin/trends/:id/publish
 * 초안(is_published=false) -> 발행(true) 전환
 */
export async function publishTrend(req: Request, res: Response) {
  const { id } = req.params;

  const [trend] = await query(
    `UPDATE trends SET is_published = true, updated_at = now()
      WHERE id = $1
      RETURNING id, title, is_published`,
    [id]
  );

  if (!trend) {
    throw new ApiError(404, '해당 트렌드를 찾을 수 없습니다.');
  }

  res.json({ trend });
}

/**
 * POST /api/admin/keywords
 * 트렌드 후보/연결 키워드 등록 (기획서 4번, keywords 테이블)
 * trendId 없이 등록하면 아직 카드로 승격 전인 "후보 키워드"로 취급됨 (스키마 12번 주석 참고)
 */
export async function createKeyword(req: Request, res: Response) {
  const { keyword, trendId } = req.body;

  if (!keyword) {
    throw new ApiError(400, 'keyword는 필수입니다.');
  }

  const [row] = await query(
    `INSERT INTO keywords (keyword, trend_id) VALUES ($1, $2)
     ON CONFLICT (keyword) DO UPDATE SET trend_id = COALESCE(EXCLUDED.trend_id, keywords.trend_id)
     RETURNING id, keyword, trend_id, created_at`,
    [keyword, trendId ?? null]
  );

  res.status(201).json({ keyword: row });
}

/**
 * GET /api/admin/keywords
 * 등록된 키워드 목록 확인용 (테스트/운영 확인용)
 */
export async function listKeywords(_req: Request, res: Response) {
  const rows = await query(
    `SELECT id, keyword, trend_id, created_at FROM keywords ORDER BY created_at DESC`
  );
  res.json({ keywords: rows });
}

/**
 * POST /api/admin/collect
 * jobs/dailyCollect.ts의 배치를 크론 스케줄 기다리지 않고 즉시 실행.
 *
 * 두 가지 용도로 쓰인다:
 *  1) 개발/시연 중 수동 실행 (데모 페이지 버튼)
 *  2) 외부 스케줄러(cron-job.org 등)가 매일 1회 호출 → 잠든 인스턴스를 깨우면서 수집까지 수행
 *     (Render 무료 플랜은 15분 미사용 시 슬립되어 node-cron이 뜨지 않기 때문)
 *
 * 이 API는 호출할 때마다 네이버·유튜브 할당량을 실제로 소모하므로,
 * COLLECT_SECRET이 설정돼 있으면 x-collect-secret 헤더가 일치해야만 실행한다.
 * 미설정 시에는 기존처럼 그냥 열려 있다(로컬 개발 편의 + 하위 호환).
 */
export async function triggerCollect(req: Request, res: Response) {
  const secret = process.env.COLLECT_SECRET;
  if (secret && req.header('x-collect-secret') !== secret) {
    throw new ApiError(401, '수집 실행 권한이 없습니다.');
  }

  const summary = await runDailyCollect();
  res.json({ summary });
}
