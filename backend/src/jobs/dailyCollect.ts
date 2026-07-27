import cron from 'node-cron';
import { query } from '../db/client';
import { fetchNaverTrends } from '../services/naverDataLab';
import { fetchYoutubeStats } from '../services/youtubeApi';
import { calculateScore, scoreToStatus } from '../services/scoring';

/**
 * 매일 1회 실행되는 수집 배치 (기획서 11-4 ④)
 * 흐름: keywords 조회 → 네이버/유튜브 API 호출 → keyword_metrics 적재
 *      → scoring.ts로 점수 계산 → trends.score/status, trend_score_history 갱신
 *
 * TODO(Day3): 아래는 골격만 잡아둔 상태. 실제 API 키 발급 후
 * - 네이버/유튜브 응답을 keyword_metrics에 upsert하는 부분
 * - collection_batches에 성공/실패, 소모 unit 기록하는 부분
 * 을 채워야 한다.
 */
export async function runDailyCollect(): Promise<void> {
  const startedAt = new Date();
  console.log(`[dailyCollect] 시작: ${startedAt.toISOString()}`);

  const keywords = await query<{ id: number; keyword: string }>(
    `SELECT id, keyword FROM keywords ORDER BY created_at DESC LIMIT 20`
  );

  if (keywords.length === 0) {
    console.log('[dailyCollect] 수집할 키워드가 없습니다. (admin에서 트렌드/키워드 먼저 등록 필요)');
    return;
  }

  try {
    const naverResults = await fetchNaverTrends(keywords.map((k) => k.keyword));
    console.log(`[dailyCollect] 네이버 데이터랩 조회 완료: ${naverResults.length}건`);

    for (const kw of keywords) {
      try {
        const yt = await fetchYoutubeStats(kw.keyword);
        console.log(`[dailyCollect] 유튜브 조회 완료: ${kw.keyword} (영상 ${yt.videoCount}건)`);
        // TODO: keyword_metrics INSERT, 이전 값과 비교해 증감률 계산 후 calculateScore() 호출
      } catch (err) {
        console.error(`[dailyCollect] 유튜브 조회 실패 (${kw.keyword}):`, err);
      }
    }
  } catch (err) {
    console.error('[dailyCollect] 배치 실행 중 오류:', err);
  }

  console.log(`[dailyCollect] 종료: ${new Date().toISOString()}`);
}

/** node-cron 스케줄 등록 (app.ts에서 명시적으로 호출해야 시작됨) */
export function scheduleDailyCollect(): void {
  const expr = process.env.DAILY_COLLECT_CRON || '0 3 * * *';
  cron.schedule(expr, () => {
    runDailyCollect().catch((err) => console.error('[dailyCollect] 실행 실패:', err));
  });
  console.log(`[dailyCollect] 스케줄 등록됨: "${expr}"`);
}

// scoreToStatus를 아직 dailyCollect 안에서 안 쓰고 있어서 lint 경고 방지용으로 재노출
export { calculateScore, scoreToStatus };
