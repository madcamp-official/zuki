import { query } from '../db/client';
import { generateTrendImage, generateBannerImage } from '../services/imageGeneration';
import { generateTrendContent, buildBasicContent, inferCategorySlug } from '../services/trendContent';
import { normalizeKeyword } from '../services/keywordDiscovery';
import { classifyStatus } from '../services/scoring';

/**
 * 수집한 키워드를 트렌드 카드로 만든다.
 *
 * === 설계 의도 ===
 *
 * 카드는 "지금 뜨는 것"만이 아니라 **감시 중인 디저트 전체의 카탈로그**다.
 * 그 안에서 확산 단계(태동기/상승기/전성기/하락기)로 나뉘고, 홈 화면은
 * 그중 신호가 강한 상위 몇 개만 보여준다. 화면별 노출은 API 쿼리
 * (sort/status/limit)로 조절하므로 카드 수를 제한할 이유가 없다.
 *
 * 한때 유행했다가 식은 메뉴도 카드로 남아야 "지난 유행"을 보여줄 수 있다.
 * 그래서 순위에서 밀렸다고 카드를 내리지 않는다 — 단계만 declining으로 바뀐다.
 *
 * === 왜 2단계로 나누나 ===
 *
 * 카드마다 근거 수집(네이버 검색 2회) + LLM 문구 + AI 이미지를 돌리면
 * 카드당 10~15초가 걸리고 이미지는 장당 과금된다. 수백 개를 한 요청에
 * 처리하면 HTTP가 먼저 끊긴다.
 *
 *   상위 richCount개 : 근거 수집 + LLM 문구 + AI 이미지   (느리고 유료)
 *   나머지           : 측정값 기반 문구, 이미지 없음        (즉시, 무료)
 *
 * 프론트 홈·랭킹이 각각 10개를 보여주므로 상위 15개에 이미지가 있으면
 * 화면은 충분히 채워진다. 나머지는 기본 이미지로 처리하면 된다.
 *
 * === 반복 실행 ===
 *
 * 한 번에 다 만들지 않고 매 실행마다 maxNewCards개씩 새로 만든다.
 * 이미 카드가 있는 키워드는 건너뛰므로, 여러 번 눌러 밀린 만큼 채워나가면 된다.
 * 응답의 remaining으로 얼마나 남았는지 알 수 있다.
 */

export interface AutoTrendSummary {
  startedAt: string;
  finishedAt: string;
  /** 카드로 만들 수 있는 후보 총 수 */
  candidates: number;
  /** 이번 실행에서 새로 만든 카드 수 */
  created: number;
  /** 문구·점수를 갱신한 기존 자동 카드 수 */
  refreshed: number;
  /** 근거 수집 + LLM + 이미지까지 붙인 카드 수 */
  enriched: number;
  /** 아직 카드가 없는 후보 수. 0이 될 때까지 다시 실행하면 된다 */
  remaining: number;
  /** 교차검증에 실패해 이번에 내린 자동 카드 수 */
  retired: number;
  /** 교차검증을 다시 통과해 이번에 되살린 자동 카드 수 */
  restored: number;
  errors: { keyword: string; message: string }[];
  trends: {
    id: number;
    keyword: string;
    signal: number;
    status: string;
    /** 근거+LLM+이미지가 붙었는지 */
    rich: boolean;
  }[];
}

interface Candidate {
  id: number;
  keyword: string;
  trend_id: number | null;
  /** 최초 발굴 소스. 'editor'면 사람이 직접 넣은 것이라 품질 규칙을 면제한다 */
  source: string;
  sources: string[];
  mention_count: number;
  search_index: string | null;
  growth_rate: string | null;
  mention_growth_rate: string | null;
  yoy_growth_rate: string | null;
  view_velocity: string | null;
  trend_signal: string;
}

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * 후보 선정 + 점수 산식.
 *
 * 핵심은 증감률을 **절댓값**으로 쓴다는 것이다. 부호를 그대로 쓰면 하락 중인
 * 키워드가 항상 최하위로 깔려 카드가 절대 만들어지지 않는다. 크게 오르든
 * 크게 내리든 "많이 움직인 것"은 사장님에게 알릴 가치가 있고, 방향 구분은
 * classifyStatus가 단계로 표현한다.
 *
 * 규모(검색지수)를 다시 넣되 비중을 낮췄다. 빼면 아무도 안 찾는 키워드가
 * 상위로 올라오고, 크게 넣으면 스테디셀러가 상위를 차지한다. 스테디셀러는
 * 아래 WHERE 절에서 "규모는 큰데 거의 안 움직이는 것"으로 따로 걸러낸다.
 */
const CANDIDATE_SQL = `
  WITH latest_index AS (
    SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
     WHERE source_type='naver' AND metric_type='search_index'
     ORDER BY keyword_id, collected_date DESC),
  latest_growth AS (
    SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
     WHERE source_type='naver' AND metric_type='search_growth_rate'
     ORDER BY keyword_id, collected_date DESC),
  latest_mention_growth AS (
    SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
     WHERE source_type='naver' AND metric_type='mention_growth_rate'
     ORDER BY keyword_id, collected_date DESC),
  latest_velocity AS (
    SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
     WHERE source_type='youtube' AND metric_type='view_velocity'
     ORDER BY keyword_id, collected_date DESC)
  SELECT k.id, k.keyword, k.trend_id, k.source, k.sources, k.mention_count,
         li.value AS search_index,
         lg.value AS growth_rate,
         lmg.value AS mention_growth_rate,
         k.yoy_growth_rate::text AS yoy_growth_rate,
         lv.value AS view_velocity,
         ROUND(
           -- 변화 강도(방향 무관) 55 + 규모 30 + 교차검증 15
           LEAST(ABS(COALESCE(lg.value,0)) + ABS(COALESCE(lmg.value,0)), 150)/150.0*55
           + LEAST(li.value, 60)/60.0*30
           + LEAST(COALESCE(array_length(k.sources,1),0),3)/3.0*15
         , 2)::text AS trend_signal
    FROM keywords k
    JOIN latest_index li ON li.keyword_id = k.id
    LEFT JOIN latest_growth lg ON lg.keyword_id = k.id
    LEFT JOIN latest_mention_growth lmg ON lmg.keyword_id = k.id
    LEFT JOIN latest_velocity lv ON lv.keyword_id = k.id
   WHERE li.value >= $1
     -- 언급 횟수 하한도 에디터 키워드는 면제한다.
     --
     -- 이 조건은 자동 발굴의 일회성 노이즈를 거르려고 둔 것이다. 사람이
     -- "이건 감시해라"라고 직접 넣은 키워드에까지 적용할 이유가 없다.
     -- 실제로 '두바이쫀득쿠키'는 표기가 40갈래로 쪼개져(두쫀쿠키/두바이쫀뜩쿠키/
     -- 군산두바이쫀득쿠키...) 각각 언급 1~2회라 전부 탈락했다. 합치면 큰 유행인데
     -- 파편화 때문에 신호가 흩어진 경우라, 에디터가 대표 표기를 지정해주면 된다.
     AND (k.source = 'editor' OR k.mention_count >= $2)
     -- is_seasonal은 여기서 거르지 않는다.
     --
     -- 원래는 "작년 같은 달에도 높았던 것"을 빼서 스테디셀러의 계절 반복을
     -- 트렌드로 오인하지 않으려던 건데, 7월 실측에서 빙수·스무디·에이드 등
     -- 여름 메뉴 전체가 걸리며 후보 127개 중 107개를 지워버렸다.
     -- 카탈로그 관점에서 계절 유행도 사장님에게 보여줄 가치가 있다 —
     -- "지금 빙수가 뜬다"는 계절성이어도 유의미한 정보다.
     -- is_seasonal 값 자체는 keywords에 남아 있어 문구·분석에 쓸 수 있다.
     -- 교차 검증: 몇 개 소스(블로그/카페/유튜브)에서 잡혔는지.
     --
     -- 이게 노이즈를 거르는 가장 효과적인 장치다. 실측 결과:
     --   소스 1개 -> 마티에부산하버시티(호텔), 돼지게티(라면), 자몽톡허니블랙티
     --   소스 2~3개 -> 씬쿠키, 샌드베이글, 왁뿌소금빵
     -- 개인 가게 이름이나 다른 카테고리 상품은 카페·디저트 검색 세 곳에서
     -- 동시에 잡히지 않는다. 규칙 기반 필터로는 '티'·'빵' 같은 흔한 어미를
     -- 끝없이 막아야 하는데, 이 조건 하나가 그걸 대체한다.
     --
     -- 단, 사람이 직접 등록한 키워드(source='editor')는 이 검사를 건너뛴다.
     -- 지난 유행(두바이초콜릿, 흑당버블티 등)은 지금 아무도 글을 안 써서
     -- 발굴에 걸리지 않는다. 그런데 "지난 유행"을 보여주려면 바로 그런
     -- 키워드가 필요하다. 교차검증은 자동 발굴의 노이즈를 거르는 장치이지,
     -- 의도적으로 넣은 감시 대상까지 막으라는 뜻이 아니다.
     AND (k.source = 'editor' OR COALESCE(array_length(k.sources, 1), 0) >= $3)
     -- 스테디셀러 제외: 규모는 큰데 거의 안 움직이는 것 (에그타르트, 밀크티 등)
     AND NOT (li.value >= 40 AND ABS(COALESCE(lg.value,0)) < 5)
   ORDER BY trend_signal DESC, k.mention_count DESC
`;

/**
 * 이미 만들어진 자동 카드에도 교차검증을 다시 적용한다.
 *
 * CANDIDATE_SQL의 WHERE 절은 **새로 만들 카드**만 거른다. 필터를 강화하기
 * 전에 만들어진 카드는 그대로 남아서, 규칙을 바꿔도 화면에는 옛날 노이즈가
 * 계속 보인다 (돼지게티=라면, 마티에부산하버시티=호텔 등).
 *
 * 그래서 매 실행마다 전체 자동 카드를 다시 검사한다. 규칙은 딱 하나 —
 * 사람이 직접 넣은 키워드가 아니면 2개 이상의 소스에서 잡혀야 한다.
 *
 * 삭제가 아니라 is_published 토글인 이유:
 *   - sources[]는 발굴이 돌 때마다 채워진다. 지금 1개여도 다음 발굴에서
 *     2개가 될 수 있고, 그때 카드가 저절로 되살아나야 한다.
 *   - 카드를 지우면 trend_id 연결과 점수 이력까지 날아간다.
 * 그래서 내리기와 되살리기를 한 쌍으로 둔다.
 */
async function revalidateAutoTrends(minSources: number) {
  const VALID = `(k.source = 'editor' OR COALESCE(array_length(k.sources, 1), 0) >= $1)`;

  const retired = await query<{ id: number }>(
    `UPDATE trends t SET is_published = false, updated_at = now()
       FROM keywords k
      WHERE k.trend_id = t.id AND t.is_auto = true AND t.is_published = true
        AND NOT ${VALID}
      RETURNING t.id`,
    [minSources]
  );

  const restored = await query<{ id: number }>(
    `UPDATE trends t SET is_published = true, updated_at = now()
       FROM keywords k
      WHERE k.trend_id = t.id AND t.is_auto = true AND t.is_published = false
        AND ${VALID}
      RETURNING t.id`,
    [minSources]
  );

  // 키워드 품질 규칙(normalizeKeyword)도 다시 적용한다.
  //
  // 그 규칙은 원래 **발굴 시점**에만 걸린다. 그래서 필터를 강화해도 이미
  // DB에 들어와 있던 키워드는 그대로 카드가 된다. 실제로 '아임도넛',
  // '준초콜릿'을 BRAND_NAMES/STOPWORDS에 넣고 DB에서 지웠는데, 배포 전
  // 발굴이 한 번 더 돌면서 다시 들어와 카드까지 만들어졌다.
  // 규칙을 고칠 때마다 사람이 DELETE를 치는 건 유지될 수 없다.
  const purged = await purgeInvalidKeywords();

  return { retired: retired.length + purged, restored: restored.length };
}

/**
 * 현재 필터 규칙을 통과하지 못하는 자동 키워드의 카드를 내린다.
 *
 * 카드만 내리고 키워드는 남긴다 — 다음 발굴에서 어차피 다시 걸러지고,
 * 지우면 방금 쌓은 지표(검색지수 시계열)까지 날아가기 때문이다.
 * 사람이 직접 넣은 키워드(editor)는 규칙과 무관하게 존중한다.
 */
async function purgeInvalidKeywords(): Promise<number> {
  const rows = await query<{ id: number; keyword: string }>(
    `SELECT t.id, k.keyword
       FROM trends t JOIN keywords k ON k.trend_id = t.id
      WHERE t.is_auto = true AND t.is_published = true AND k.source <> 'editor'`
  );

  const invalid = rows.filter((r) => normalizeKeyword(r.keyword) === null);
  if (invalid.length === 0) return 0;

  await query(
    `UPDATE trends SET is_published = false, updated_at = now() WHERE id = ANY($1::bigint[])`,
    [invalid.map((r) => r.id)]
  );
  console.log(
    `[autoTrends] 필터 규칙 재적용으로 ${invalid.length}개 내림: ` +
      invalid.slice(0, 10).map((r) => r.keyword).join(', ')
  );
  return invalid.length;
}

export interface AutoTrendOptions {
  /** 이번 실행에서 새로 만들 카드 수 상한. 요청이 끊기지 않을 만큼만 */
  maxNewCards?: number;
  /** 근거 수집 + LLM 문구 + AI 이미지를 붙일 상위 카드 수 */
  richCount?: number;
  /** 최소 검색지수 */
  minIndex?: number;
  /** 최소 언급 횟수 (가게 이름 등 일회성 표현 배제) */
  minMentions?: number;
  /**
   * 최소 소스 수. 기본 2 — 두 곳 이상에서 잡힌 것만 카드로 만든다.
   * 한 곳에서만 나온 키워드는 그 소스의 편향이거나 카페 트렌드가 아닌
   * 경우가 대부분이다(호텔 이름, 라면 등). 1로 낮추면 후보는 늘지만
   * 노이즈도 같이 늘어난다.
   */
  minSources?: number;
  /** AI 이미지 생성 여부. 카드당 과금되므로 끌 수 있게 둔다 */
  withImage?: boolean;
  /** 손으로 만든 카드(시드 더미 포함)도 함께 내릴지 */
  retireManual?: boolean;
}

export async function refreshAutoTrends(
  options: AutoTrendOptions = {}
): Promise<AutoTrendSummary> {
  const {
    maxNewCards = 60,
    richCount = 15,
    minIndex = 5,
    minMentions = 2,
    minSources = 2,
    withImage = true,
    retireManual = false,
  } = options;

  const startedAt = new Date();
  const summary: AutoTrendSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    candidates: 0,
    created: 0,
    refreshed: 0,
    enriched: 0,
    remaining: 0,
    retired: 0,
    restored: 0,
    errors: [],
    trends: [],
  };

  // 새 카드를 만들기 전에 기존 카드부터 현재 규칙으로 다시 검사한다
  const revalidated = await revalidateAutoTrends(minSources);
  summary.retired = revalidated.retired;
  summary.restored = revalidated.restored;

  /*
   * 후보에도 키워드 품질 규칙을 적용한다.
   *
   * revalidateAutoTrends가 실행 **시작 시점**에 돌고 그 뒤에 생성 루프가 도는데,
   * 생성 쪽은 CANDIDATE_SQL만 보고 normalizeKeyword를 안 거쳤다. 그래서 방금
   * 내린 카드를 같은 실행에서 곧바로 다시 만들었다 — '아임도넛', '빙수'가
   * 계속 살아 있던 이유다. SQL로는 표현할 수 없는 규칙(브랜드명·형태 단어
   * 단독·수식어 조합)이라 여기서 한 번 더 거른다.
   */
  const rawCandidates = await query<Candidate>(CANDIDATE_SQL, [minIndex, minMentions, minSources]);
  const candidates = rawCandidates.filter(
    (c) => c.source === 'editor' || normalizeKeyword(c.keyword) !== null
  );
  summary.candidates = candidates.length;

  // 아직 카드가 없는 후보만 이번 실행에서 새로 만든다.
  // 이미 있는 것은 상위 richCount 안에 들 때만 문구를 갱신한다.
  const withoutCard = candidates.filter((c) => c.trend_id === null);
  const toCreate = withoutCard.slice(0, maxNewCards);
  summary.remaining = Math.max(withoutCard.length - toCreate.length, 0);

  // 상위 richCount개는 근거+LLM+이미지를 붙인다. 순위는 전체 후보 기준
  const richKeywordIds = new Set(candidates.slice(0, richCount).map((c) => c.id));

  /** 새로 만들 것 + 상위권 기존 카드(문구 갱신 대상) */
  const targets = [
    ...toCreate,
    ...candidates.filter((c) => c.trend_id !== null && richKeywordIds.has(c.id)),
  ];

  for (const c of targets) {
    const signal = Number(c.trend_signal);
    const isRich = richKeywordIds.has(c.id);

    try {
      const signalInput = {
        keyword: c.keyword,
        searchGrowthRate: num(c.growth_rate),
        mentionGrowthRate: num(c.mention_growth_rate),
        yoyGrowthRate: num(c.yoy_growth_rate),
        mentionCount: c.mention_count,
        sources: c.sources ?? [],
        searchIndex: num(c.search_index),
        viewVelocity: num(c.view_velocity),
      };

      // 상위권만 실제 게시물을 검색해 근거 기반 문구를 만든다.
      // 나머지는 측정값만으로 문구를 구성한다 (외부 호출 없음, 즉시).
      const content = isRich
        ? await generateTrendContent(signalInput)
        : buildBasicContent(signalInput);

      const status = classifyStatus({
        searchLevel: signalInput.searchIndex,
        searchMomentum: signalInput.searchGrowthRate,
        youtubeMomentum: null,
        editorScore: 50,
      });

      if (c.trend_id) {
        await query(
          `UPDATE trends
              SET summary      = CASE WHEN is_auto THEN $2 ELSE summary END,
                  reason       = CASE WHEN is_auto THEN $3 ELSE reason END,
                  evidence     = CASE WHEN is_auto THEN $6::jsonb ELSE evidence END,
                  status       = $4,
                  score        = $5,
                  auto_signal  = $5,
                  is_published = true,
                  updated_at   = now()
            WHERE id = $1`,
          [c.trend_id, content.summary, content.reason, status, signal, JSON.stringify(content.evidence)]
        );
        summary.refreshed += 1;
        if (isRich) summary.enriched += 1;
        summary.trends.push({ id: c.trend_id, keyword: c.keyword, signal, status, rich: isRich });
        continue;
      }

      const categorySlug = inferCategorySlug(c.keyword);
      const [category] = await query<{ id: number }>(
        `SELECT id FROM categories WHERE slug = $1`,
        [categorySlug]
      );

      const [trend] = await query<{ id: number }>(
        `INSERT INTO trends
           (title, summary, reason, evidence, category_id, status, score,
            region_scope, primary_source, is_published, is_auto, auto_signal)
         VALUES ($1, $2, $3, $7::jsonb, $4, $5, $6, 'nationwide', 'naver', true, true, $6)
         RETURNING id`,
        [
          c.keyword, content.summary, content.reason, category?.id ?? 1,
          status, signal, JSON.stringify(content.evidence),
        ]
      );

      // 키워드를 카드에 연결해야 다음 수집부터 이 카드의 점수가 갱신된다
      await query(`UPDATE keywords SET trend_id = $1 WHERE id = $2`, [trend.id, c.id]);

      summary.created += 1;
      summary.trends.push({ id: trend.id, keyword: c.keyword, signal, status, rich: isRich });

      // 이미지는 상위권에만. 실패해도 카드 생성을 막지 않는다
      if (isRich && withImage) {
        try {
          // gatherEvidence()로 이미 확보해둔 실제 뉴스/블로그 발췌를 그대로
          // 재사용한다 — "돼지게티" 같은 신조어도 원문에서 실제 생김새 힌트를
          // 얻어 이미지를 더 정확하게 그릴 수 있다 (추가 API 호출 없음).
          const url = await generateTrendImage(
            String(trend.id),
            c.keyword,
            categorySlug,
            content.summary,
            content.evidence,
          );
          await query(`UPDATE trends SET image_url = $1 WHERE id = $2`, [url, trend.id]);
          summary.enriched += 1;
        } catch (err) {
          console.warn(`[autoTrends] "${c.keyword}" 이미지 생성 실패:`, err);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[autoTrends] "${c.keyword}" 처리 실패:`, message);
      summary.errors.push({ keyword: c.keyword, message });
    }
  }

  // 손으로 만든 카드(시드 더미) 정리 — 요청했을 때만.
  // 자동 카드가 하나도 없으면 사이트가 통째로 비므로 내리지 않는다.
  if (retireManual) {
    const [autoCount] = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM trends WHERE is_auto = true AND is_published = true`
    );
    if (Number(autoCount?.n ?? 0) > 0) {
      await query(
        `UPDATE trends SET is_published = false, updated_at = now()
          WHERE is_auto = false AND is_published = true`
      );
    }
  }

  // 1위 트렌드가 바뀌었으면 홈 히어로 배너 전용 이미지를 새로 만든다.
  // 순위가 그대로면 배너도 그대로 둔다 — 매 배치마다 과금하지 않기 위함이다.
  if (withImage) {
    try {
      await refreshTopBanner();
    } catch (err) {
      console.warn('[autoTrends] 배너 이미지 갱신 실패:', err);
    }
  }

  const finishedAt = new Date();
  summary.finishedAt = finishedAt.toISOString();

  console.log(
    `[autoTrends] 완료: 생성 ${summary.created} / 갱신 ${summary.refreshed} / ` +
      `상세생성 ${summary.enriched} / 내림 ${summary.retired} / 되살림 ${summary.restored} / ` +
      `남은 후보 ${summary.remaining}`
  );
  return summary;
}

interface TopTrendRow {
  id: number;
  title: string;
  summary: string | null;
  category_slug: string;
  evidence: { title: string; excerpt: string }[] | null;
  banner_image_url: string | null;
}

/**
 * 발행 중인 트렌드 중 최고 점수(1위)를 찾아, 이전 1위와 다르면 배너 이미지를 새로 만든다.
 * 같은 트렌드가 계속 1위면 이미 banner_image_url이 있으니 다시 만들지 않는다.
 */
async function refreshTopBanner(): Promise<void> {
  const [top] = await query<TopTrendRow>(
    `SELECT t.id, t.title, t.summary, c.slug AS category_slug, t.evidence, t.banner_image_url
       FROM trends t
       JOIN categories c ON c.id = t.category_id
      WHERE t.is_published = true
      ORDER BY t.score DESC
      LIMIT 1`
  );

  if (!top || top.banner_image_url) return;

  const evidence = Array.isArray(top.evidence) ? top.evidence : [];
  const url = await generateBannerImage(
    top.id,
    top.title,
    top.category_slug,
    top.summary,
    evidence,
  );
  await query(`UPDATE trends SET banner_image_url = $1 WHERE id = $2`, [url, top.id]);
  console.log(`[autoTrends] 1위 "${top.title}" 배너 이미지 생성 완료`);
}
