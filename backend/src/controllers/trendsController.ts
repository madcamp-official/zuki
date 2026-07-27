import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';

/**
 * GET /api/trends
 * 홈 브리핑 / 카테고리 탐색 (기획서 4-1, 4-3)
 * 쿼리 파라미터: category(slug), status, limit
 */
export async function listTrends(req: Request, res: Response) {
  const { category, status, limit } = req.query;

  const conditions: string[] = ['t.is_published = true'];
  const params: unknown[] = [];

  if (category) {
    params.push(category);
    conditions.push(`c.slug = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  const limitNum = Math.min(Number(limit) || 20, 100);
  params.push(limitNum);

  const rows = await query(
    `SELECT t.id, t.title, t.summary, t.status, t.score, t.image_url,
            t.region_scope, t.created_at,
            c.name AS category_name, c.slug AS category_slug
       FROM trends t
       JOIN categories c ON c.id = t.category_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.created_at DESC
      LIMIT $${params.length}`,
    params
  );

  res.json({ trends: rows });
}

/**
 * GET /api/trends/:id
 * 트렌드 상세: 카드 정보 + 스코어 추이 그래프 데이터 (기획서 13)
 */
export async function getTrendDetail(req: Request, res: Response) {
  const { id } = req.params;

  const [trend] = await query(
    `SELECT t.id, t.title, t.summary, t.reason, t.status, t.score,
            t.image_url, t.region_scope, t.created_at,
            c.name AS category_name, c.slug AS category_slug
       FROM trends t
       JOIN categories c ON c.id = t.category_id
      WHERE t.id = $1 AND t.is_published = true`,
    [id]
  );

  if (!trend) {
    throw new ApiError(404, '해당 트렌드를 찾을 수 없습니다.');
  }

  const history = await query(
    `SELECT score, status, recorded_date
       FROM trend_score_history
      WHERE trend_id = $1
      ORDER BY recorded_date ASC`,
    [id]
  );

  res.json({ trend, scoreHistory: history });
}

/**
 * GET /api/categories
 * 카테고리 탐색 필터용 (디저트/음료/마케팅, 기획서 4-3)
 */
export async function listCategories(_req: Request, res: Response) {
  const rows = await query(
    `SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order ASC`
  );
  res.json({ categories: rows });
}
