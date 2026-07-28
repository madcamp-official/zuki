import cron from 'node-cron';
import { query } from '../db/client';
import {
  NAVER_MAX_KEYWORDS_PER_CALL,
  NaverTrendPoint,
  fetchNaverTrends,
} from '../services/naverDataLab';
import { fetchYoutubeStats } from '../services/youtubeApi';
import { calculateScore, classifyStatus } from '../services/scoring';

const today = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

/**
 * 유튜브 일일 할당량 10,000 unit / 키워드당 101 unit(search.list 100 + videos.list 1)
 * => 하루 최대 약 99개. 발굴(1 unit)과 여유분을 남겨 80개로 상한을 둔다.
 */
const YOUTUBE_KEYWORD_LIMIT = Number(process.env.YOUTUBE_KEYWORD_LIMIT ?? 80);

/**
 * 네이버는 호출당 5개 × 하루 1,000회 = 5,000개까지 가능하지만,
 * 실행 시간이 길어지므로 기본 상한을 둔다.
 */
const NAVER_KEYWORD_LIMIT = Number(process.env.NAVER_KEYWORD_LIMIT ?? 500);

/** 네이버 호출 사이 대기(ms). 연속 호출로 속도 제한에 걸리는 것을 방지 */
const NAVER_CALL_DELAY_MS = Number(process.env.NAVER_CALL_DELAY_MS ?? 200);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 네이버 검색지수 시계열에서 수준(level)과 증감률(momentum)을 뽑는다.
 *
 * 단순히 "오늘 vs 7일 전" 두 시점을 비교하지 않고,
 * **최근 7일 평균 vs 그 이전 7일 평균**을 비교한다. 이유:
 *
 *  1) 요일 효과 — 카페 디저트 검색은 주말에 몰린다. 하루 단위 비교는
 *     월요일과 일요일을 견주게 되어 항상 급락처럼 보인다.
 *  2) 이상치 내성 — 특정 하루가 이벤트로 튀어도 평균이 흡수한다.
 *
 * 14일치가 필요하지만 네이버가 3개월 시계열을 통째로 주므로,
 * 우리 수집 이력과 무관하게 첫 실행부터 계산 가능하다.
 *
 * level은 "현재 수준"이므로 최근 7일 평균을 쓴다(마지막 하루보다 안정적).
 */
export function calcNaverSignals(points: NaverTrendPoint[]): {
  level: number | null;
  changeRate: number | null;
} {
  if (points.length === 0) return { level: null, changeRate: null };

  const recent = points.slice(-7);
  const previous = points.slice(-14, -7);
  const avg = (arr: NaverTrendPoint[]) => arr.reduce((s, p) => s + p.ratio, 0) / arr.length;

  const level = round2(avg(recent));

  // 이전 7일이 없거나(데이터 부족) 기준값이 0이면 증감률 판단 불가
  if (previous.length === 0) return { level, changeRate: null };
  const base = avg(previous);
  if (base === 0) return { level, changeRate: null };

  return { level, changeRate: round2(((avg(recent) - base) / base) * 100) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 유튜브는 스냅샷(현재 시점 영상 수)만 주기 때문에 시계열을 우리가 직접 쌓아야 한다.
 *
 * 네이버와 기간을 맞추기 위해 "7일 이내 가장 오래된 기록"과 비교한다.
 * (직전 수집일과 비교하면 네이버는 7일 변화, 유튜브는 1일 변화가 되어
 *  기간이 다른 두 값을 가중합하는 문제가 생긴다)
 *
 * 이전 데이터가 없으면 null — 수집 2일차부터 값이 생긴다.
 */
async function calcYoutubeChangeRate(keywordId: number, latestVideoCount: number): Promise<number | null> {
  const rows = await query<{ value: string }>(
    `SELECT value FROM keyword_metrics
      WHERE keyword_id = $1 AND source_type = 'youtube' AND metric_type = 'video_count'
        AND collected_date <  $2::date
        AND collected_date >= $2::date - INTERVAL '7 days'
      ORDER BY collected_date ASC LIMIT 1`,
    [keywordId, today()]
  );
  if (rows.length === 0) return null;
  const prev = Number(rows[0].value);
  if (prev === 0) return null;
  return ((latestVideoCount - prev) / prev) * 100;
}

async function upsertMetric(
  keywordId: number,
  sourceType: 'naver' | 'youtube',
  metricType: string,
  value: number
) {
  await query(
    `INSERT INTO keyword_metrics (keyword_id, source_type, metric_type, value, collected_date)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (keyword_id, source_type, metric_type, collected_date)
     DO UPDATE SET value = EXCLUDED.value`,
    [keywordId, sourceType, metricType, value, today()]
  );
}

export interface DailyCollectSummary {
  startedAt: string;
  finishedAt: string;
  /** 네이버로 훑은 키워드 수 (후보 포함 전체) */
  naverProcessed: number;
  /** 유튜브까지 수집한 키워드 수 (트렌드 카드에 연결된 것만) */
  youtubeProcessed: number;
  /** 점수·확산단계가 갱신된 트렌드 카드 수 */
  trendsUpdated: number;
  failed: number;
  errors: { keyword: string; message: string }[];
}

interface KeywordRow {
  id: number;
  keyword: string;
  trend_id: number | null;
}

/**
 * 매일 1회 실행되는 수집 배치 (기획서 11-4 ④)
 *
 * 2단계로 나눠 수집한다 — 유튜브 할당량이 네이버보다 훨씬 빡빡하기 때문:
 *
 *   1단계 (넓게): 후보 포함 전체 키워드를 네이버로 훑는다.
 *                호출당 5개씩 묶어서 보내므로 수백 개도 감당된다.
 *                "뭐가 뜨고 있나"를 넓게 감시하는 용도.
 *
 *   2단계 (깊게): 트렌드 카드에 연결된 키워드만 유튜브까지 수집하고
 *                점수를 계산해 카드 상태를 갱신한다.
 *
 * 에디터 가중치(11-5 공식의 0.2)를 입력받는 화면/필드가 아직 없어서
 * 임시로 중립값(50)을 사용한다.
 */
export async function runDailyCollect(): Promise<DailyCollectSummary> {
  const startedAt = new Date();
  console.log(`[dailyCollect] 시작: ${startedAt.toISOString()}`);

  const batch = await query<{ id: number }>(
    `INSERT INTO collection_batches (source_type, status, started_at)
     VALUES ('naver', 'partial', now()) RETURNING id`
  );
  const batchId = batch[0]?.id;

  const summary: DailyCollectSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    naverProcessed: 0,
    youtubeProcessed: 0,
    trendsUpdated: 0,
    failed: 0,
    errors: [],
  };

  let apiCallsUsed = 0;

  // ---------------------------------------------------------------
  // 1단계: 전체 키워드를 네이버로 훑기 (트렌드 연결된 것 우선)
  // ---------------------------------------------------------------
  const allKeywords = await query<KeywordRow>(
    `SELECT id, keyword, trend_id FROM keywords
      ORDER BY (trend_id IS NULL), created_at DESC
      LIMIT $1`,
    [NAVER_KEYWORD_LIMIT]
  );

  /** keyword 문자열 -> 네이버 수준/증감률. 2단계 점수 계산에서 재사용한다. */
  const naverByKeyword = new Map<string, { level: number | null; changeRate: number | null }>();

  const byKeyword = new Map(allKeywords.map((k) => [k.keyword, k]));

  // 묶음(5개)마다 호출 -> 즉시 저장. 전부 모아뒀다가 한꺼번에 쓰면
  // 도중에 요청이 끊길 때 그때까지의 수집분이 통째로 날아가고,
  // 진행 상황도 밖에서 확인할 수 없다.
  for (let i = 0; i < allKeywords.length; i += NAVER_MAX_KEYWORDS_PER_CALL) {
    const chunk = allKeywords.slice(i, i + NAVER_MAX_KEYWORDS_PER_CALL);

    try {
      const results = await fetchNaverTrends(
        chunk.map((k) => k.keyword),
        3
      );
      apiCallsUsed += 1;

      for (const r of results) {
        const kw = byKeyword.get(r.keyword);
        if (!kw) continue;
        const calc = calcNaverSignals(r.points);
        naverByKeyword.set(r.keyword, calc);
        await upsertMetric(kw.id, 'naver', 'search_index', calc.level ?? 0);

        // 증감률도 함께 저장한다.
        // 네이버가 3개월 시계열을 통째로 주므로 이 값은 첫 수집에서 이미 계산돼 있다.
        // 저장하지 않으면 조회 시점에 DB에 쌓인 값끼리 다시 비교해야 하고,
        // 그러면 이틀치가 쌓일 때까지 증감률을 보여줄 수 없다.
        if (calc.changeRate !== null) {
          await upsertMetric(kw.id, 'naver', 'search_growth_rate', calc.changeRate);
        }

        await query(`UPDATE keywords SET last_collected_at = now() WHERE id = $1`, [kw.id]);
        summary.naverProcessed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[dailyCollect] 네이버 묶음 실패 (${chunk.map((k) => k.keyword).join(', ')}):`, message);
      summary.failed += chunk.length;
      summary.errors.push({ keyword: chunk.map((k) => k.keyword).join(', '), message });
    }

    // 진행 상황을 밖에서 확인할 수 있도록 배치 레코드를 갱신
    // (HTTP 요청이 타임아웃돼도 작업은 계속되므로, 상태 조회용 흔적을 남긴다)
    if (batchId) {
      await query(`UPDATE collection_batches SET api_calls_used = $1 WHERE id = $2`, [
        apiCallsUsed,
        batchId,
      ]);
    }

    // 연속 호출로 속도 제한에 걸리지 않도록 짧게 쉬어간다
    if (i + NAVER_MAX_KEYWORDS_PER_CALL < allKeywords.length) {
      await sleep(NAVER_CALL_DELAY_MS);
    }
  }

  console.log(`[dailyCollect] 네이버 완료: ${summary.naverProcessed}/${allKeywords.length}`);

  // ---------------------------------------------------------------
  // 2단계: 트렌드 카드에 연결된 키워드만 유튜브 수집 + 점수 갱신
  // ---------------------------------------------------------------
  const linkedKeywords = allKeywords
    .filter((k) => k.trend_id !== null)
    .slice(0, YOUTUBE_KEYWORD_LIMIT);

  for (const kw of linkedKeywords) {
    try {
      const yt = await fetchYoutubeStats(kw.keyword);
      apiCallsUsed += 101; // search.list(100) + videos.list(1)

      const youtubeChangeRate = await calcYoutubeChangeRate(kw.id, yt.videoCount);
      await upsertMetric(kw.id, 'youtube', 'video_count', yt.videoCount);
      await upsertMetric(kw.id, 'youtube', 'view_count', yt.totalViewCount);
      // 네이버와 동일하게 계산된 증감률을 저장해둔다 (조회 시 재계산 불필요)
      if (youtubeChangeRate !== null) {
        await upsertMetric(kw.id, 'youtube', 'mention_growth_rate', youtubeChangeRate);
      }
      summary.youtubeProcessed += 1;

      const naver = naverByKeyword.get(kw.keyword);
      const signals = {
        searchLevel: naver?.level ?? null,
        searchMomentum: naver?.changeRate ?? null,
        youtubeMomentum: youtubeChangeRate,
        editorScore: 50, // TODO: 관리자 화면에서 에디터 점수 입력받게 되면 교체
      };
      // 점수(랭킹용)와 단계(분류용)를 각각 계산한다 — 용도가 다르다
      const score = calculateScore(signals);
      const status = classifyStatus(signals);

      await query(`UPDATE trends SET score = $1, status = $2, updated_at = now() WHERE id = $3`, [
        score,
        status,
        kw.trend_id,
      ]);
      await query(
        `INSERT INTO trend_score_history (trend_id, score, status, recorded_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (trend_id, recorded_date) DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status`,
        [kw.trend_id, score, status, today()]
      );
      summary.trendsUpdated += 1;

      console.log(`[dailyCollect] "${kw.keyword}" score=${score} status=${status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[dailyCollect] "${kw.keyword}" 유튜브 실패:`, message);
      summary.failed += 1;
      summary.errors.push({ keyword: kw.keyword, message });
    }
  }

  const finishedAt = new Date();
  summary.finishedAt = finishedAt.toISOString();

  if (batchId) {
    const processed = summary.naverProcessed + summary.youtubeProcessed;
    const finalStatus = summary.failed === 0 ? 'success' : processed === 0 ? 'failed' : 'partial';
    await query(
      `UPDATE collection_batches SET status = $1, api_calls_used = $2, finished_at = $3 WHERE id = $4`,
      [finalStatus, apiCallsUsed, finishedAt.toISOString(), batchId]
    );
  }

  console.log(
    `[dailyCollect] 종료: 네이버 ${summary.naverProcessed} / 유튜브 ${summary.youtubeProcessed} / 실패 ${summary.failed}`
  );
  return summary;
}

/** node-cron 스케줄 등록 (app.ts에서 명시적으로 호출해야 시작됨) */
export function scheduleDailyCollect(): void {
  const expr = process.env.DAILY_COLLECT_CRON || '0 3 * * *';
  cron.schedule(expr, () => {
    runDailyCollect().catch((err) => console.error('[dailyCollect] 실행 실패:', err));
  });
  console.log(`[dailyCollect] 스케줄 등록됨: "${expr}"`);
}
