import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';
import { runDailyCollect } from '../jobs/dailyCollect';
import { generateTrendImage } from '../services/imageGeneration';

/**
 * POST /api/admin/trends
 * 에디터 수동 큐레이션 입력 (기획서 11-4 ③, source: 'editor')
 * MVP 단계에서는 별도 관리자 화면 대신 이 API를 Postman/스크립트로 직접 호출해도 됨
 * (17번 "다음 논의가 필요한 사항" - 관리자 화면 별도 개발 여부 미정)
 *
 * imageUrl을 안 넘기면 OpenAI로 자동 생성한다 (services/imageGeneration.ts).
 * 생성에 5~15초 정도 걸려 응답이 그만큼 늦어지지만, 등록 시점에 바로 완성된
 * image_url을 받아볼 수 있도록 동기 처리한다. 생성 실패해도 트렌드 등록 자체는
 * 막지 않고 image_url만 비워둔다 (나중에 scripts/generate-trend-images.ts로 재생성 가능).
 */
export async function createTrend(req: Request, res: Response) {
  const { title, summary, categoryId, reason, imageUrl, regionScope, createdBy } = req.body;

  if (!title || !categoryId) {
    throw new ApiError(400, 'title, categoryId는 필수입니다.');
  }

  const [trend] = await query<{
    id: string;
    title: string;
    status: string;
    image_url: string | null;
    is_published: boolean;
    created_at: string;
  }>(
    `INSERT INTO trends (title, summary, category_id, reason, image_url, region_scope, primary_source, created_by)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'nationwide'), 'editor', $7)
     RETURNING id, title, status, image_url, is_published, created_at`,
    [title, summary ?? null, categoryId, reason ?? null, imageUrl ?? null, regionScope ?? null, createdBy ?? null]
  );

  if (!imageUrl) {
    const [category] = await query<{ slug: string }>(
      `SELECT slug FROM categories WHERE id = $1`,
      [categoryId]
    );

    try {
      const generatedUrl = await generateTrendImage(
        trend.id,
        title,
        category?.slug ?? 'dessert',
        summary ?? null,
      );
      await query('UPDATE trends SET image_url = $1 WHERE id = $2', [
        generatedUrl,
        trend.id,
      ]);
      trend.image_url = generatedUrl;
    } catch (err) {
      // AI 이미지 생성이 실패해도 트렌드 등록 자체는 이미 완료된 상태이므로 막지 않는다.
      // image_url 없이 응답하고, 나중에 scripts/generate-trend-images.ts로 재생성 가능.
      console.error('[createTrend] AI 이미지 생성 실패, image_url 없이 등록됨:', err);
    }
  }

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
 * jobs/dailyCollect.ts의 배치를 크론 스케줄 기다리지 않고 즉시 실행 (테스트/운영 확인용)
 * 실제 운영에서는 node-cron이 매일 새벽 3시에 자동으로 호출함 (기획서 11-4 ④)
 */
export async function triggerCollect(_req: Request, res: Response) {
  const summary = await runDailyCollect();
  res.json({ summary });
}
