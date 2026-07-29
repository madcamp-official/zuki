import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';
import { runDailyCollect } from '../jobs/dailyCollect';
import { refreshAutoTrends } from '../jobs/autoTrends';
import { runKeywordDiscovery } from '../jobs/discoverKeywords';
import { getPipelineStatus, runPipeline } from '../jobs/pipeline';
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
 * body: { youtube?: boolean, naver?: boolean }
 *   youtube — 유튜브 인기 급상승 영상 제목에서 추출 (기본 true, 4 unit 소모)
 *   naver   — 네이버 블로그·카페글 최신 포스트 제목에서 추출 (기본 true, 10회 호출)
 *
 * 둘 다 "지금 실제로 올라오고 있는 콘텐츠"에서 가져온다.
 * 여기서는 "후보를 쌓기만" 한다. 실제 검색량은 다음 수집 배치가 채우고,
 * 그 결과는 GET /api/admin/keywords/rising 으로 확인한다.
 */
export async function discoverKeywords(req: Request, res: Response) {
  const summary = await runKeywordDiscovery({
    youtube: req.body?.youtube !== false,
    blog: req.body?.blog !== false,
    cafe: req.body?.cafe !== false,
  });

  res.json({
    ...summary,
    message:
      `후보 ${summary.discovered}개 (신규 ${summary.inserted}, 갱신 ${summary.updated}). ` +
      `이 중 ${summary.multiSource}개는 이번 실행에서 2개 이상 소스에 동시에 잡혔습니다. ` +
      `검색량은 다음 수집 배치가 채우며, 결과는 GET /api/admin/keywords/rising 에서 확인하세요.`,
  });
}

/**
 * POST /api/admin/pipeline
 * 발굴 → 수집 → 카드 갱신을 한 번에 돌린다.
 *
 * 수 분씩 걸리므로 **기다리지 않고 202로 즉시 응답**한다. 외부 스케줄러
 * (cron-job.org)는 보통 30초에서 끊기기 때문에, 동기로 처리하면 작업이
 * 정상 완료돼도 스케줄러 쪽에는 실패로 기록된다.
 *
 * 진행 상황은 GET /api/admin/pipeline 으로 확인한다.
 *
 * 보호는 라우터의 requireSecretOrAdmin이 담당한다.
 * 외부 스케줄러는 x-collect-secret, 데모 페이지는 로그인 토큰을 쓴다.
 */
export async function triggerPipeline(req: Request, res: Response) {
  if (getPipelineStatus().running) {
    res.status(409).json({ message: '이미 실행 중입니다.', status: getPipelineStatus() });
    return;
  }

  const options = {
    discover: req.body?.discover !== false,
    youtube: req.body?.youtube === true,
    collect: req.body?.collect === true,
    autoRefresh: req.body?.autoRefresh === true,
    withImage: req.body?.withImage !== false,
    maxNewCards: Math.min(Number(req.body?.maxNewCards ?? 60), 200),
    richCount: Math.min(Number(req.body?.richCount ?? 15), 50),
  };

  // 응답을 기다리게 하지 않는다. 실패는 runPipeline 안에서 잡아 상태에 기록된다.
  void runPipeline('api', options).catch((err) =>
    console.error('[pipeline] API 트리거 실패:', err)
  );

  res.status(202).json({
    message: '파이프라인을 시작했습니다. GET /api/admin/pipeline 으로 진행 상황을 확인하세요.',
    options,
  });
}

/** GET /api/admin/pipeline — 진행 중이거나 마지막으로 끝난 실행 상태 */
export async function getPipeline(_req: Request, res: Response) {
  res.json(getPipelineStatus());
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
  /** 검색량이 사실상 없는 키워드 제외. 정렬엔 안 쓰고 필터로만 쓴다 */
  const minIndex = Number(req.query.minIndex ?? 5);
  const includeLinked = req.query.includeLinked === 'true';
  /** 1회만 언급된 것은 대부분 가게 이름이나 일회성 표현이라 기본 제외 */
  const minMentions = Number(req.query.minMentions ?? 2);
  /** 최소 소스 수. 2로 올리면 한 소스에서만 잡힌 것(=그 소스의 편향 가능성)을 제외 */
  const minSources = Number(req.query.minSources ?? 1);
  /** 스테디셀러 제외: 검색지수가 이 값 이상인데 증감률이 미미하면 유행이 아니라 상시 메뉴 */
  const excludeStaples = req.query.excludeStaples !== 'false';
  const stapleIndex = Number(req.query.stapleIndex ?? 40);
  const stapleGrowth = Number(req.query.stapleGrowth ?? 5);
  /** 계절성 반복(작년 같은 달에도 비슷하게 높았던 것) 제외 */
  const excludeSeasonal = req.query.excludeSeasonal !== 'false';

  // 조건이 선택적이라 파라미터 번호를 순차적으로 붙여 나간다
  const params: unknown[] = [minIndex, minMentions, minSources];
  const conditions: string[] = [
    'li.value >= $1',
    'k.mention_count >= $2',
    'COALESCE(array_length(k.sources, 1), 0) >= $3',
  ];

  if (!includeLinked) conditions.push('k.trend_id IS NULL');
  if (excludeSeasonal) conditions.push('k.is_seasonal = false');
  if (excludeStaples) {
    params.push(stapleIndex, stapleGrowth);
    conditions.push(
      `NOT (li.value >= $${params.length - 1} AND COALESCE(lg.value, 0) < $${params.length})`
    );
  }
  params.push(limit);

  // 증감률은 수집 시점에 계산해 저장해둔 값을 그대로 읽는다.
  // (DB에 쌓인 날짜별 값끼리 다시 비교하면 이틀치가 쌓일 때까지 값이 안 나온다)
  const rows = await query(
    `WITH latest_index AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value, collected_date
         FROM keyword_metrics
        WHERE source_type = 'naver' AND metric_type = 'search_index'
        ORDER BY keyword_id, collected_date DESC
     ),
     latest_growth AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value
         FROM keyword_metrics
        WHERE source_type = 'naver' AND metric_type = 'search_growth_rate'
        ORDER BY keyword_id, collected_date DESC
     ),
     latest_mention_growth AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value
         FROM keyword_metrics
        WHERE source_type = 'naver' AND metric_type = 'mention_growth_rate'
        ORDER BY keyword_id, collected_date DESC
     ),
     latest_velocity AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value
         FROM keyword_metrics
        WHERE source_type = 'youtube' AND metric_type = 'view_velocity'
        ORDER BY keyword_id, collected_date DESC
     )
     SELECT k.id, k.keyword, k.trend_id,
            k.sources, COALESCE(array_length(k.sources, 1), 0) AS source_count,
            k.mention_count, k.mention_by_source, k.mention_window_days,
            k.is_seasonal, k.yoy_growth_rate,
            li.value AS search_index,
            li.collected_date,
            lg.value  AS growth_rate,
            lmg.value AS mention_growth_rate,
            lv.value  AS view_velocity,
            -- 트렌드 신호 = 언급 증가율(45) + 검색 증가율(30) + 교차검증(25)
            --
            -- 언급 증가율에 무게를 두는 이유: 새로 뜨는 메뉴는 검색량보다
            -- 블로그 게시가 먼저 늘어난다. 사람들이 검색하기 전에 글부터 올라온다.
            --
            -- 교차검증(소스 수)을 넣는 이유: 어떤 발굴 소스도 편향이 있다.
            -- 한 곳에서만 잡힌 키워드는 그 소스의 편향일 수 있고, 실제로
            -- 개인 카페·빵집 이름은 대개 블로그 한 곳에서만 나온다.
            --
            -- 검색지수(=이미 자리잡은 정도)는 정렬에 쓰지 않는다.
            -- 넣으면 에그타르트·밀크티 같은 스테디셀러가 상위를 차지한다.
            ROUND(
              (LEAST(GREATEST(COALESCE(lmg.value, 0), -100), 200) + 100) / 300.0 * 45
              + (LEAST(GREATEST(COALESCE(lg.value, 0), -50), 50) + 50) / 100.0 * 30
              + LEAST(COALESCE(array_length(k.sources, 1), 0), 3) / 3.0 * 25
            , 1) AS trend_signal
       FROM keywords k
       JOIN latest_index li ON li.keyword_id = k.id
       LEFT JOIN latest_growth lg ON lg.keyword_id = k.id
       LEFT JOIN latest_mention_growth lmg ON lmg.keyword_id = k.id
       LEFT JOIN latest_velocity lv ON lv.keyword_id = k.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY trend_signal DESC, k.mention_count DESC
      LIMIT $${params.length}`,
    params
  );

  res.json({
    keywords: rows,
    filters: {
      minIndex, minMentions, minSources, excludeStaples, stapleIndex,
      stapleGrowth, excludeSeasonal, includeLinked,
    },
    note:
      'trend_signal 내림차순 정렬 = 언급 증가율(45점) + 검색 증가율(30점) + 교차검증(25점). ' +
      '교차검증은 몇 개 소스(블로그/카페/유튜브)에서 잡혔는지입니다 — 어떤 소스도 편향이 있어서, 한 곳에서만 나온 것보다 여러 곳에서 나온 것을 신뢰합니다. 개인 카페 이름은 대개 한 소스에서만 나오므로 이 점수가 노이즈도 걸러줍니다. ' +
      '검색지수는 정렬에 쓰지 않습니다 — 넣으면 이미 자리잡은 스테디셀러가 상위를 차지해 발굴이 되지 않습니다. ' +
      `제외 조건: 검색지수 ${minIndex} 미만, 언급 ${minMentions}회 미만, 소스 ${minSources}개 미만, ` +
      `검색지수 ${stapleIndex} 이상이면서 검색 증감률 ${stapleGrowth}% 미만(상시 메뉴), is_seasonal=true(계절 메뉴). ` +
      'mention_growth_rate가 null이면 14일 구간을 못 덮었거나 표본이 10건 미만이라 계산을 포기한 것입니다(억지로 값을 내지 않습니다). ' +
      'view_velocity는 최근 30일 영상들의 일평균 조회수 합으로, 짧은 시간에 조회수가 터지는 정도를 나타냅니다.',
  });
}

/**
 * POST /api/admin/trends/auto-refresh
 * 상위 트렌드를 자동으로 카드화하고, 순위에서 밀린 자동 카드는 내린다.
 *
 * body: { topN?: number, minSignal?: number, withImage?: boolean }
 *
 * 문구는 실제 뉴스·블로그를 검색해 그 내용을 근거로 생성하며,
 * 근거가 된 게시물 링크를 카드에 함께 저장한다(evidence).
 * 에디터가 직접 만든 카드(is_auto=false)의 문구는 덮어쓰지 않는다.
 */
export async function triggerAutoTrends(req: Request, res: Response) {
  const summary = await refreshAutoTrends({
    // 한 번에 다 만들지 않는다. 요청이 끊기지 않을 만큼만 처리하고,
    // 남은 개수(remaining)를 응답에 담아 다시 실행할 수 있게 한다.
    maxNewCards: Math.min(Number(req.body?.maxNewCards ?? 60), 200),
    // 근거 수집 + LLM 문구 + AI 이미지를 붙일 상위 카드 수 (카드당 과금)
    richCount: Math.min(Number(req.body?.richCount ?? 15), 50),
    minIndex: Number(req.body?.minIndex ?? 5),
    minMentions: Number(req.body?.minMentions ?? 2),
    // 소스 2개 이상만 카드로. 호텔·라면 등 카페 트렌드가 아닌 것을 걸러낸다
    minSources: Number(req.body?.minSources ?? 2),
    withImage: req.body?.withImage !== false,
    // 시드 더미를 걷어내고 실제 수집 데이터만 보이게 할 때 사용. 기본은 안전하게 false
    retireManual: req.body?.retireManual === true,
  });
  res.json({ summary });
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
 * 라우터의 requireSecretOrAdmin으로 보호한다
 * (스케줄러는 x-collect-secret, 데모 페이지는 로그인 토큰).
 */
export async function triggerCollect(_req: Request, res: Response) {
  const summary = await runDailyCollect();
  res.json({ summary });
}
