import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';
import { runDailyCollect } from '../jobs/dailyCollect';
import {
  DiscoveredKeyword,
  discoverFromYoutube,
  generateSeedKeywords,
} from '../services/keywordDiscovery';

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
 * 쿼리: candidate=true 면 아직 카드로 승격 안 된 후보 키워드만
 */
export async function listKeywords(req: Request, res: Response) {
  const onlyCandidates = req.query.candidate === 'true';
  const rows = await query(
    `SELECT id, keyword, trend_id, source, last_collected_at, created_at
       FROM keywords
      ${onlyCandidates ? 'WHERE trend_id IS NULL' : ''}
      ORDER BY created_at DESC
      LIMIT 500`
  );
  res.json({ keywords: rows });
}

/**
 * POST /api/admin/keywords/discover
 * 후보 키워드를 발굴해 DB에 적재한다 (기획서 "트렌드 예측"의 재료 수집 단계).
 *
 * body: { youtube?: boolean, seed?: boolean, seedLimit?: number }
 *   youtube — 유튜브 인기 급상승 영상 제목에서 추출 (기본 true, 3 unit 소모)
 *   seed    — 재료 x 형태 조합 생성 (기본 true, 외부 호출 없음)
 *
 * 여기서는 "후보를 쌓기만" 한다. 실제 검색량은 다음 수집 배치가 채우고,
 * 그 결과는 GET /api/admin/keywords/rising 으로 확인한다.
 */
export async function discoverKeywords(req: Request, res: Response) {
  const useYoutube = req.body?.youtube !== false;
  const useSeed = req.body?.seed !== false;
  const seedLimit = Number(req.body?.seedLimit ?? 300);

  const discovered: DiscoveredKeyword[] = [];
  const errors: string[] = [];

  if (useYoutube) {
    try {
      discovered.push(...(await discoverFromYoutube()));
    } catch (err) {
      errors.push(`유튜브 발굴 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (useSeed) {
    discovered.push(...generateSeedKeywords(seedLimit));
  }

  // 중복 제거 (유튜브에서 나온 것을 우선 — 실제 콘텐츠 기반이라 신뢰도가 높음)
  const unique = new Map<string, DiscoveredKeyword>();
  for (const d of discovered) {
    if (!unique.has(d.keyword)) unique.set(d.keyword, d);
  }

  let inserted = 0;
  let skipped = 0;

  for (const d of unique.values()) {
    // keyword는 VARCHAR(50) UNIQUE. 이미 있으면 건드리지 않는다
    // (에디터가 카드에 연결해둔 키워드의 source/trend_id를 덮어쓰면 안 되므로)
    const rows = await query<{ id: number }>(
      `INSERT INTO keywords (keyword, source) VALUES ($1, $2)
       ON CONFLICT (keyword) DO NOTHING
       RETURNING id`,
      [d.keyword.slice(0, 50), d.source]
    );
    if (rows.length > 0) inserted += 1;
    else skipped += 1;
  }

  res.json({
    discovered: unique.size,
    inserted,
    skipped,
    errors,
    message:
      inserted > 0
        ? `후보 키워드 ${inserted}개를 등록했습니다. 다음 수집 배치가 검색량을 채운 뒤 /api/admin/keywords/rising 에서 확인하세요.`
        : '새로 등록된 키워드가 없습니다 (이미 전부 등록됨).',
  });
}

/**
 * GET /api/admin/keywords/rising
 * 급상승 중인 후보 키워드 목록 — "무엇을 트렌드 카드로 만들지" 고르는 화면용.
 *
 * 최신 검색지수와 7일 이내 기준값을 비교해 증감률 순으로 정렬한다.
 * 검색량 자체가 미미한 키워드(조합 생성물 대부분)는 minIndex로 걸러낸다.
 *
 * 쿼리: limit(기본 30), minIndex(기본 1), includeLinked(기본 false)
 */
export async function listRisingKeywords(req: Request, res: Response) {
  const limit = Math.min(Number(req.query.limit) || 30, 200);
  const minIndex = Number(req.query.minIndex ?? 1);
  const includeLinked = req.query.includeLinked === 'true';

  const rows = await query(
    `WITH m AS (
       SELECT keyword_id, value, collected_date
         FROM keyword_metrics
        WHERE source_type = 'naver' AND metric_type = 'search_index'
     ),
     latest AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value, collected_date
         FROM m ORDER BY keyword_id, collected_date DESC
     ),
     base AS (
       SELECT DISTINCT ON (m.keyword_id) m.keyword_id, m.value
         FROM m JOIN latest l ON l.keyword_id = m.keyword_id
        WHERE m.collected_date <  l.collected_date
          AND m.collected_date >= l.collected_date - INTERVAL '7 days'
        ORDER BY m.keyword_id, m.collected_date ASC
     )
     SELECT k.id, k.keyword, k.source, k.trend_id,
            l.value AS search_index,
            l.collected_date,
            CASE WHEN b.value > 0
                 THEN ROUND(((l.value - b.value) / b.value) * 100, 1)
            END AS growth_rate
       FROM keywords k
       JOIN latest l ON l.keyword_id = k.id
       LEFT JOIN base b ON b.keyword_id = k.id
      WHERE l.value >= $1
        ${includeLinked ? '' : 'AND k.trend_id IS NULL'}
      ORDER BY growth_rate DESC NULLS LAST, l.value DESC
      LIMIT $2`,
    [minIndex, limit]
  );

  res.json({
    keywords: rows,
    note:
      'growth_rate가 null이면 비교할 과거 데이터가 아직 없다는 뜻입니다(수집 2일차부터 값이 생깁니다). 카드로 만들 키워드를 고른 뒤 POST /api/admin/trends로 카드를 만들고 POST /api/admin/keywords로 연결하세요.',
  });
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
