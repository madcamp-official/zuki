import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';

/**
 * 트렌드별 수집 지표를 뽑는 공통 CTE.
 *
 * 증감률은 여기서 계산하지 않고, 수집 배치가 저장해둔 값을 그대로 읽는다.
 * 네이버가 3개월 시계열을 통째로 주기 때문에 증감률은 첫 수집에서 이미
 * 계산 가능하다. DB에 쌓인 날짜별 값끼리 다시 비교하는 방식이면 이틀치가
 * 쌓일 때까지 값을 보여줄 수 없어서, 계산 시점의 값을 저장하는 쪽을 택했다.
 *
 * metric_type 별 의미:
 *   naver/search_index         최근 7일 평균 검색지수 (0~100)
 *   naver/search_growth_rate   최근 28일 평균 대 이전 28일 평균 증감률 (%)
 *                              — 반짝 스파이크가 아니라 자리 잡는 유행을 재기 위해 28일
 *   youtube/video_count        키워드 검색 결과 영상 수
 *   youtube/view_count         조회수 상위 영상 10개의 조회수 합
 *   youtube/mention_growth_rate 영상 수 증감률 (%)
 */
const METRICS_CTE = `
  WITH latest AS (
    SELECT DISTINCT ON (k.trend_id, km.source_type, km.metric_type)
           k.trend_id, km.source_type, km.metric_type, km.value
      FROM keywords k
      JOIN keyword_metrics km ON km.keyword_id = k.id
     WHERE k.trend_id IS NOT NULL
     ORDER BY k.trend_id, km.source_type, km.metric_type, km.collected_date DESC
  ),
  metrics AS (
    SELECT trend_id,
           MAX(value) FILTER (WHERE source_type = 'naver'   AND metric_type = 'search_index')        AS search_index,
           MAX(value) FILTER (WHERE source_type = 'naver'   AND metric_type = 'search_growth_rate')  AS search_growth_rate,
           MAX(value) FILTER (WHERE source_type = 'youtube' AND metric_type = 'video_count')         AS yt_video_count,
           MAX(value) FILTER (WHERE source_type = 'youtube' AND metric_type = 'view_count')          AS yt_view_count,
           MAX(value) FILTER (WHERE source_type = 'youtube' AND metric_type = 'mention_growth_rate') AS mention_growth_rate
      FROM latest
     GROUP BY trend_id
  )
`;

const METRIC_COLUMNS = `
  mt.search_growth_rate,
  mt.mention_growth_rate,
  mt.search_index,
  mt.yt_video_count AS youtube_video_count,
  mt.yt_view_count  AS youtube_view_count
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
            t.image_url, t.banner_image_url, t.region_scope, t.created_at,
            t.is_auto, t.evidence,
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
  /*
   * 날짜를 먼저 만들고 값을 붙인다 (generate_series LEFT JOIN).
   *
   * 네이버는 검색량이 0인 날을 응답에서 빼기 때문에, 있는 행만 그리면
   * 카드마다 그래프 구간이 달라진다 (신상은 30일, 오래된 건 60일).
   * 증감률이 "최근 28일 대 이전 28일"이라 최소 56일은 보여야 근거가 읽히므로,
   * 60일을 고정으로 깔고 빠진 날은 0으로 채운다.
   */
  const searchIndexHistory = await query(
    `WITH span AS (
       SELECT generate_series(
         (CURRENT_DATE - INTERVAL '59 days')::date, CURRENT_DATE, '1 day'
       )::date AS d
     ),
     vals AS (
       SELECT km.collected_date AS d, km.value
         FROM keywords k
         JOIN keyword_metrics km ON km.keyword_id = k.id
        WHERE k.trend_id = $1
          AND km.source_type = 'naver'
          -- 원본 일별 값을 쓴다. search_index는 7일 평균이라 수집 횟수만큼(하루 1개)
          -- 밖에 없어서 그래프가 그려지지 않는다.
          AND km.metric_type = 'search_index_daily'
     )
     SELECT span.d AS recorded_date, COALESCE(vals.value, 0) AS search_index
       FROM span LEFT JOIN vals ON vals.d = span.d
      ORDER BY span.d ASC`,
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
