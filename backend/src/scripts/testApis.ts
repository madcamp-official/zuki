/**
 * 네이버 데이터랩 / 유튜브 API 연동 확인용 스크립트 (Day2)
 * 실제 API 키를 .env에 넣은 뒤 로컬에서 직접 실행해서
 * services/naverDataLab.ts, services/youtubeApi.ts가 정상 동작하는지 확인한다.
 *
 * 실행:
 *   cd backend
 *   npx ts-node -r dotenv/config src/scripts/testApis.ts
 */
import { fetchNaverTrends } from '../services/naverDataLab';
import { fetchYoutubeStats } from '../services/youtubeApi';

const TEST_KEYWORD = process.argv[2] || '크로플';

async function main() {
  console.log(`테스트 키워드: "${TEST_KEYWORD}"\n`);

  console.log('=== 1. 네이버 데이터랩 검색어트렌드 ===');
  try {
    const naverResults = await fetchNaverTrends([TEST_KEYWORD], 3);
    console.log('성공. 응답:');
    console.dir(naverResults, { depth: null });
  } catch (err) {
    console.error('실패:', err instanceof Error ? err.message : err);
  }

  console.log('\n=== 2. 유튜브 데이터 API ===');
  try {
    const ytResult = await fetchYoutubeStats(TEST_KEYWORD, 5);
    console.log('성공. 응답:');
    console.dir(ytResult, { depth: null });
  } catch (err) {
    console.error('실패:', err instanceof Error ? err.message : err);
  }
}

main();
