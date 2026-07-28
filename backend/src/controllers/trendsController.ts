import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';

/**
 * 트렌드별 수집 지표(검색량/언급량) 증감률을 계산하는 공통 CTE.
 *
 * keyword_metrics에는 네이버 검색지수·유튜브 영상수/조회수가 날짜별로 쌓이는데,
 * 프론트는 "얼마나 늘었는지(%)"를 원하기 때문에 여기서 증감률로 가공해 내보낸다.
 *
 * 기준값은 "최신 수집일로부터 7일 이내에 있는 가장 오래된 값".
 * 매일 수집이 보장되지 않아도(주말 누락 등) 비교 대상이 잡히도록 이렇게 잡았다.
 * 비교할 과거 데이터가 없거나 기준값이 0이면 NULL(= 아직 판단 불가)로 둔다.
 */
const METRICS_CTE = `
  WITH m AS (
    SELECT k.trend_id, km.source_type, km.metric_type, km.value, km.collected_date
      FROM keywords k
      JOIN keyword_metrics km ON km.keyword_id = k.id
     WHERE k.trend_id IS NOT NULL
  ),
  latest AS (
    SELECT DISTINCT ON (trend_id, source_type, metric_type)
           trend_id, source_type, metric_type, value, collected_date
      FROM m
     ORDER BY trend_id, source_type, metric_type, collected_date DESC
  ),
  base AS (
    SELECT DISTINCT ON (m.trend_id, m.source_type, m.metric_type)
           m.trend_id, m.source_type, m.metric_type, m.value
      FROM m
      JOIN latest l
        ON l.trend_id = m.trend_id
       AND l.source_type = m.source_type
       AND l.metric_type = m.metric_type
     WHERE m.collected_date <  l.collected_date
       AND m.collected_date >= l.collected_date - INTERVAL '7 days'
     ORDER BY m.trend_id, m.source_type, m.metric_type, m.collected_date ASC
  ),
  joined AS (
    SELECT l.trend_id, l.source_type, l.metric_type,
           l.value AS latest_value, b.value AS base_value
      FROM latest l
      LEFT JOIN base b
        ON b.trend_id = l.trend_id
       AND b.source_type = l.source_type
       AND b.metric_type = l.metric_type
  ),
  metrics AS (
    SELECT trend_id,
           MAX(latest_value) FILTER (WHERE source_type = 'naver'   AND metric_type = 'search_index') AS naver_latest,
           MAX(base_value)   FILTER (WHERE source_type = 'naver'   AND metric_type = 'search_index') AS naver_base,
           MAX(latest_value) FILTER (WHERE source_type = 'youtube' AND metric_type = 'video_count')  AS yt_latest,
           MAX(base_value)   FILTER (WHERE source_type = 'youtube' AND metric_type = 'video_count')  AS yt_base,
           MAX(latest_value) FILTER (WHERE source_type = 'youtube' AND metric_type = 'view_count')   AS yt_views
      FROM joined
     GROUP BY trend_id
  )
`;

/** metrics CTE 결과를 증감률(%) 컬럼으로 변환. 기준값이 없거나 0이면 NULL. */
const METRIC_COLUMNS = `
  CASE WHEN mt.naver_base > 0
       THEN ROUND(((mt.naver_latest - mt.naver_base) / mt.naver_base) * 100, 1)
  END AS search_growth_rate,
  CASE WHEN mt.yt_base > 0
       THEN ROUND(((mt.yt_latest - mt.yt_base) / mt.yt_base) * 100, 1)
  END AS mention_growth_rate,
  mt.naver_latest AS search_index,
  mt.yt_latest    AS youtube_video_count,
  mt.yt_views     AS youtube_view_count
`;

/**
 * GET /api/trends
 * 홈 브리핑 / 카테고리 탐색 (기획서 4-1, 4-3)
 *
 * 쿼리 파라미터:
 *   category — 카테고리 slug
 *   status   — emerging | rising | peak | declining
 *   limit    — 기본 20, 최대 100
 *   sort     — latest(기본, 최신순) | score(점수 높은 순)
 *
 * sort는 화이트리스트로만 받는다. 사용자 입력을 ORDER BY에 그대로 넣으면
 * SQL 인젝션이 되기 때문에, 미리 정의한 문자열로만 치환한다.
 */
const SORT_OPTIONS: Record<string, string> = {
  latest: 't.created_at DESC',
  score: 't.score DESC NULLS LAST, t.created_at DESC',
};

export async function listTrends(req: Request, res: Response) {
  const { category, status, limit, sort } = req.query;

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

  const orderBy = SORT_OPTIONS[String(sort)] ?? SORT_OPTIONS.latest;

  const limitNum = Math.min(Number(limit) || 20, 100);
  params.push(limitNum);

  const rows = await query(
    `${METRICS_CTE}
     SELECT t.id, t.title, t.summary, t.status, t.score, t.image_url,
            t.region_scope, t.created_at,
            c.name AS category_name, c.slug AS category_slug,
            ${METRIC_COLUMNS},
            sh.score_history
       FROM trends t
       JOIN categories c ON c.id = t.category_id
       LEFT JOIN metrics mt ON mt.trend_id = t.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(json_agg(x ORDER BY x.recorded_date), '[]'::json) AS score_history
           FROM (
             SELECT score, status, recorded_date
               FROM trend_score_history
              WHERE trend_id = t.id
              ORDER BY recorded_date DESC
              LIMIT 14
           ) x
       ) sh ON true
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
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
    `${METRICS_CTE}
     SELECT t.id, t.title, t.summary, t.reason, t.status, t.score,
            t.image_url, t.region_scope, t.created_at,
            c.name AS category_name, c.slug AS category_slug,
            ${METRIC_COLUMNS}
       FROM trends t
       JOIN categories c ON c.id = t.category_id
       LEFT JOIN metrics mt ON mt.trend_id = t.id
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

  // 프론트 "검색량 추이" 그래프용 — 네이버 검색지수 원본 시계열.
  // scoreHistory(점수 이력)와는 다른 값이다. 화면 라벨이 "네이버 데이터랩 기준
  // 상대 검색지수(0~100)"이므로 이 배열을 써야 맞다.
  const searchIndexHistory = await query(
    `SELECT km.collected_date AS recorded_date, km.value AS search_index
       FROM keywords k
       JOIN keyword_metrics km ON km.keyword_id = k.id
      WHERE k.trend_id = $1
        AND km.source_type = 'naver'
        AND km.metric_type = 'search_index'
      ORDER BY km.collected_date ASC`,
    [id]
  );

  res.json({ trend, scoreHistory: history, searchIndexHistory });
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
