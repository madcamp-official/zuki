/**
 * 유튜브 데이터 API v3 연동 (기획서 11-4 ②)
 * - search.list: 키워드 검색, 100 unit 소모
 * - videos.list: 영상 상세, 1 unit 소모
 * - 하루 10,000 unit 한도 (자정 태평양시 초기화) → search.list 기준 하루 최대 약 100회
 *   => 배치는 하루 1회, 핵심 키워드만 선별 조회 (기획서 16 리스크 대응)
 * - 키 발급: Google Cloud Console (신용카드 불필요)
 */

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

export interface YoutubeKeywordStat {
  keyword: string;
  videoCount: number;
  totalViewCount: number;
}

/**
 * 키워드로 최근 영상을 검색해 개수/조회수 합계를 반환한다.
 * search.list 1회(100 unit) + videos.list 1회(1 unit) 소모.
 * TODO(Day2-3): 실제 쿼터 소모량을 collection_batches 테이블에 기록하는 로직 추가
 */
export async function fetchYoutubeStats(keyword: string, maxResults = 10): Promise<YoutubeKeywordStat> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');
  }

  const searchParams = new URLSearchParams({
    part: 'id',
    q: keyword,
    type: 'video',
    order: 'date',
    maxResults: String(maxResults),
    key: apiKey,
  });

  const searchRes = await fetch(`${YOUTUBE_SEARCH_URL}?${searchParams}`);
  if (!searchRes.ok) {
    throw new Error(`유튜브 search.list 오류: ${searchRes.status} ${await searchRes.text()}`);
  }
  const searchJson = (await searchRes.json()) as {
    pageInfo: { totalResults: number };
    items: { id: { videoId: string } }[];
  };

  const videoIds = searchJson.items.map((i) => i.id.videoId).filter(Boolean);
  let totalViewCount = 0;

  if (videoIds.length > 0) {
    const videosParams = new URLSearchParams({
      part: 'statistics',
      id: videoIds.join(','),
      key: apiKey,
    });
    const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videosParams}`);
    if (videosRes.ok) {
      const videosJson = (await videosRes.json()) as {
        items: { statistics: { viewCount: string } }[];
      };
      totalViewCount = videosJson.items.reduce(
        (sum, v) => sum + Number(v.statistics.viewCount || 0),
        0
      );
    }
  }

  return {
    keyword,
    videoCount: searchJson.pageInfo.totalResults,
    totalViewCount,
  };
}
