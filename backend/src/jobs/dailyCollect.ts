import cron from 'node-cron';
import { query } from '../db/client';
import { fetchNaverTrends, NaverTrendPoint } from '../services/naverDataLab';
import { fetchYoutubeStats } from '../services/youtubeApi';
import { calculateScore, scoreToStatus } from '../services/scoring';

const today = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

/**
 * 네이버 데이터랩은 한 번 호출로 최근 N개월치 시계열을 통째로 돌려주기 때문에,
 * 그 응답 안에서 "최근 값 vs ~7일 전 값"을 비교해 증감률을 바로 계산한다.
 * (과거 실행 결과를 DB에서 다시 조회할 필요 없음)
 */
function calcNaverChangeRate(points: NaverTrendPoint[]): { latest: number; changeRate: number | null } {
  if (points.length === 0) return { latest: 0, changeRate: null };
  const latest = points[points.length - 1].ratio;
  const compareIdx = points.length - 1 - 7;
  if (compareIdx < 0) return { latest, changeRate: null }; // 데이터가 7일치도 안 쌓인 경우
  const base = points[compareIdx].ratio;
  if (base === 0) return { latest, changeRate: null };
  return { latest, changeRate: ((latest - base) / base) * 100 };
}

/**
 * 유튜브는 스냅샷(현재 시점 영상 수)만 주기 때문에, 어제까지 keyword_metrics에 쌓아둔
 * 값과 비교해서 증감률을 계산한다. 첫 실행이라 이전 값이 없으면 null(데이터 없음)로 처리.
 */
async function calcYoutubeChangeRate(keywordId: number, latestVideoCount: number): Promise<number | null> {
  const rows = await query<{ value: string }>(
    `SELECT value FROM keyword_metrics
      WHERE keyword_id = $1 AND source_type = 'youtube' AND metric_type = 'video_count' AND collected_date < $2
      ORDER BY collected_date DESC LIMIT 1`,
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
  totalKeywords: number;
  processed: number;
  failed: number;
  errors: { keyword: string; message: string }[];
}

/**
 * 매일 1회 실행되는 수집 배치 (기획서 11-4 ④)
 * 흐름: keywords 조회 → 네이버/유튜브 API 호출 → keyword_metrics 적재
 *      → scoring.ts로 점수 계산 → trends.score/status, trend_score_history 갱신
 *
 * 에디터 가중치(11-5 공식의 나머지 0.2)를 입력받는 화면/필드가 아직 없어서,
 * 임시로 중립값(50)을 사용한다. (17번 "다음 논의가 필요한 사항" - 관리자 화면 미정과 연결된 TODO)
 */
export async function runDailyCollect(): Promise<DailyCollectSummary> {
  const startedAt = new Date();
  console.log(`[dailyCollect] 시작: ${startedAt.toISOString()}`);

  const batch = await query<{ id: number }>(
    `INSERT INTO collection_batches (source_type, status, started_at)
     VALUES ('naver', 'partial', now()) RETURNING id`
  );
  const batchId = batch[0]?.id;

  const keywords = await query<{ id: number; keyword: string; trend_id: number | null }>(
    `SELECT id, keyword, trend_id FROM keywords ORDER BY created_at DESC LIMIT 20`
  );

  const summary: DailyCollectSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    totalKeywords: keywords.length,
    processed: 0,
    failed: 0,
    errors: [],
  };

  let apiCallsUsed = 0;

  for (const kw of keywords) {
    try {
      // 1. 네이버 데이터랩 (최근 3개월 시계열)
      const [naverResult] = await fetchNaverTrends([kw.keyword], 3);
      const { latest: naverLatest, changeRate: naverChangeRate } = calcNaverChangeRate(
        naverResult?.points ?? []
      );
      await upsertMetric(kw.id, 'naver', 'search_index', naverLatest);

      // 2. 유튜브 (현재 스냅샷)
      const yt = await fetchYoutubeStats(kw.keyword);
      apiCallsUsed += 101; // search.list(100) + videos.list(1)
      const youtubeChangeRate = await calcYoutubeChangeRate(kw.id, yt.videoCount);
      await upsertMetric(kw.id, 'youtube', 'video_count', yt.videoCount);
      await upsertMetric(kw.id, 'youtube', 'view_count', yt.totalViewCount);

      // 3. 스코어링 (기획서 11-5)
      const score = calculateScore({
        naverChangeRate,
        youtubeChangeRate,
        editorScore: 50, // TODO: 관리자 화면에서 에디터 점수 입력받게 되면 교체
      });
      const status = scoreToStatus(score);

      // 4. 트렌드 카드에 연결된 키워드면 trends/trend_score_history 갱신
      if (kw.trend_id) {
        await query(
          `UPDATE trends SET score = $1, status = $2, updated_at = now() WHERE id = $3`,
          [score, status, kw.trend_id]
        );
        await query(
          `INSERT INTO trend_score_history (trend_id, score, status, recorded_date)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (trend_id, recorded_date) DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status`,
          [kw.trend_id, score, status, today()]
        );
      }

      console.log(
        `[dailyCollect] "${kw.keyword}" 완료 (naver=${naverLatest}, yt영상=${yt.videoCount}, score=${score}, status=${status})`
      );
      summary.processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[dailyCollect] "${kw.keyword}" 실패:`, message);
      summary.failed += 1;
      summary.errors.push({ keyword: kw.keyword, message });
    }
  }

  const finishedAt = new Date();
  summary.finishedAt = finishedAt.toISOString();

  if (batchId) {
    const finalStatus = summary.failed === 0 ? 'success' : summary.processed === 0 ? 'failed' : 'partial';
    await query(
      `UPDATE collection_batches SET status = $1, api_calls_used = $2, finished_at = $3 WHERE id = $4`,
      [finalStatus, apiCallsUsed, finishedAt.toISOString(), batchId]
    );
  }

  console.log(`[dailyCollect] 종료: ${finishedAt.toISOString()} (${summary.processed}/${summary.totalKeywords} 성공)`);
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
