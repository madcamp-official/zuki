/**
 * 유튜브 데이터 API v3 연동 (기획서 11-4 ②)
 * - search.list: 키워드 검색, 100 unit 소모
 * - videos.list: 영상 상세, 1 unit 소모
 * - 하루 10,000 unit 한도 (자정 태평양시 초기화) → search.list 기준 하루 최대 약 100회
 *   => 배치는 하루 1회, 핵심 키워드만 선별 조회 (기획서 16 리스크 대응)
 * - 키 발급: Google Cloud Console (신용카드 불필요)
 */

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export interface YoutubeKeywordStat {
  keyword: string;
  videoCount: number;
  totalViewCount: number;
  /**
   * 조회수 속도 (일평균 조회수).
   *
   * 왜 필요한가: 절대 조회수는 트렌드 신호가 아니다.
   *   영상 A: 100만 조회 / 3년 전 업로드  ->  하루 900회
   *   영상 B:   5만 조회 / 5일 전 업로드  ->  하루 1만회   <- 이게 지금 유행
   * order=viewCount로만 뽑으면 A가 1등이 되어 "역대 인기"를 재게 된다.
   * 최근 영상만 대상으로 (조회수 / 업로드 후 경과일)을 구해야 현재 열기를 잰다.
   */
  viewVelocity: number | null;
  /** 조회수 속도 계산에 쓰인 최근 영상 수 */
  recentVideoCount: number;
}

/** 최근 N일 이내 업로드된 영상만 대상으로 삼는다 */
const RECENT_DAYS = Number(process.env.YOUTUBE_RECENT_DAYS ?? 30);

function publishedAfterISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
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

  // publishedAfter로 최근 N일 영상만 본다.
  // 이게 없으면 3년 전 조회수 100만 영상이 1등이 되어 "역대 인기"를 재게 된다.
  const searchParams = new URLSearchParams({
    part: 'id',
    q: keyword,
    type: 'video',
    order: 'viewCount',
    publishedAfter: publishedAfterISO(RECENT_DAYS),
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
  let viewVelocity: number | null = null;
  let recentVideoCount = 0;

  if (videoIds.length > 0) {
    // snippet(업로드 시각) + statistics(조회수)를 함께 받아 속도를 계산한다
    const videosParams = new URLSearchParams({
      part: 'statistics,snippet',
      id: videoIds.join(','),
      key: apiKey,
    });
    const videosRes = await fetch(`${YOUTUBE_VIDEOS_URL}?${videosParams}`);
    if (videosRes.ok) {
      const videosJson = (await videosRes.json()) as {
        items: {
          statistics: { viewCount?: string };
          snippet: { publishedAt: string };
        }[];
      };

      const now = Date.now();
      let velocitySum = 0;

      for (const v of videosJson.items) {
        const views = Number(v.statistics?.viewCount ?? 0);
        totalViewCount += views;

        const ageDays = (now - new Date(v.snippet.publishedAt).getTime()) / (24 * 60 * 60 * 1000);
        // 업로드 직후(몇 시간)면 나눗셈이 폭주하므로 최소 1일로 본다
        velocitySum += views / Math.max(ageDays, 1);
        recentVideoCount += 1;
      }

      if (recentVideoCount > 0) {
        viewVelocity = Math.round(velocitySum);
      }
    }
  }

  return {
    keyword,
    videoCount: searchJson.pageInfo.totalResults,
    totalViewCount,
    viewVelocity,
    recentVideoCount,
  };
}

export interface YoutubeDiscoveredVideo {
  title: string;
  channelTitle: string;
  publishedAt: string;
  views: number;
  /** 일평균 조회수 */
  velocity: number;
}

/**
 * 주제 쿼리로 최근 영상을 찾아 조회수 속도 순으로 돌려준다 — 키워드 발굴용.
 *
 * 왜 채널을 고정하지 않는가:
 *   특정 유튜버를 골라 넣으면 고르는 사람의 취향과 그 채널의 구독자층 편향이
 *   그대로 들어간다. 대신 매번 검색으로 "지금 이 주제에서 조회수가 잘 나오는
 *   영상"을 찾으면, 영향력 있는 채널이 자연스럽게 뽑히고 유행이 바뀌면
 *   구성도 알아서 바뀐다.
 *
 * 비용: 쿼리당 search.list 100 unit + videos.list 1 unit.
 */
export async function discoverVideosByQuery(
  query: string,
  maxResults = 50
): Promise<YoutubeDiscoveredVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');
  }

  const searchParams = new URLSearchParams({
    part: 'id',
    q: query,
    type: 'video',
    order: 'viewCount',
    publishedAfter: publishedAfterISO(RECENT_DAYS),
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    maxResults: String(Math.min(maxResults, 50)),
    key: apiKey,
  });

  const searchRes = await fetch(`${YOUTUBE_SEARCH_URL}?${searchParams}`);
  if (!searchRes.ok) {
    throw new Error(`유튜브 search.list 오류: ${searchRes.status} ${(await searchRes.text()).slice(0, 200)}`);
  }
  const searchJson = (await searchRes.json()) as { items?: { id: { videoId?: string } }[] };
  const videoIds = (searchJson.items ?? []).map((i) => i.id.videoId).filter(Boolean) as string[];
  if (videoIds.length === 0) return [];

  const videosParams = new URLSearchParams({
    part: 'statistics,snippet',
    id: videoIds.join(','),
    key: apiKey,
  });
  const videosRes = await fetch(`${YOUTUBE_VIDEOS_URL}?${videosParams}`);
  if (!videosRes.ok) {
    throw new Error(`유튜브 videos.list 오류: ${videosRes.status}`);
  }
  const videosJson = (await videosRes.json()) as {
    items?: {
      statistics: { viewCount?: string };
      snippet: { title: string; channelTitle: string; publishedAt: string };
    }[];
  };

  const now = Date.now();
  return (videosJson.items ?? [])
    .map((v) => {
      const views = Number(v.statistics?.viewCount ?? 0);
      const ageDays = (now - new Date(v.snippet.publishedAt).getTime()) / (24 * 60 * 60 * 1000);
      return {
        title: v.snippet.title,
        channelTitle: v.snippet.channelTitle,
        publishedAt: v.snippet.publishedAt,
        views,
        velocity: Math.round(views / Math.max(ageDays, 1)),
      };
    })
    .sort((a, b) => b.velocity - a.velocity);
}
