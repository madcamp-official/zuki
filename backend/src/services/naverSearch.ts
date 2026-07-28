/**
 * 네이버 검색 오픈 API 연동 (블로그 / 카페글)
 *
 * 왜 필요한가:
 *   네이버 데이터랩은 "내가 준 키워드가 얼마나 뜨나"만 답한다. 급상승 키워드
 *   목록을 주는 API는 없다(실시간 검색어는 2021년 폐지). 그래서 "뭐가 뜨나"를
 *   알려면 실제 콘텐츠를 읽어야 한다.
 *
 *   블로그·카페글 검색을 최신순으로 부르면 "지금 사람들이 카페/디저트에 대해
 *   쓰고 있는 글"의 제목을 얻을 수 있고, 거기서 키워드를 추출한다.
 *
 * 인증: 데이터랩과 동일한 X-Naver-Client-Id / X-Naver-Client-Secret
 * 한도: 검색 API는 하루 25,000회 (데이터랩 1,000회와 별도)
 */

const SEARCH_BASE = 'https://openapi.naver.com/v1/search';

export type NaverSearchCorpus = 'blog' | 'cafearticle' | 'news';

export interface NaverSearchResult {
  corpus: NaverSearchCorpus;
  query: string;
  titles: string[];
  /**
   * 게시일(YYYY-MM-DD) 목록. 블로그 코퍼스만 postdate를 준다.
   * 카페글은 cafename/cafeurl만 오고 날짜가 없어 빈 배열이 된다.
   */
  postDates: string[];
  /** 전체 검색 결과 수 (누적값이라 "속도"가 아님에 주의) */
  total: number;
}

/** 네이버 검색 결과 제목에는 <b> 강조 태그와 HTML 엔티티가 섞여 온다 */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * 한 코퍼스에서 검색어 하나로 최신 글 제목을 가져온다.
 * sort=date(최신순)를 쓰는 이유: 트렌드 발굴이 목적이라 정확도보다 신선도가 중요.
 */
export async function searchNaver(
  query: string,
  corpus: NaverSearchCorpus = 'blog',
  display = 100,
  start = 1
): Promise<NaverSearchResult> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않았습니다.');
  }

  const params = new URLSearchParams({
    query,
    display: String(Math.min(display, 100)), // API 상한 100
    start: String(Math.min(Math.max(start, 1), 1000)), // API 상한 1000
    sort: 'date',
  });

  const res = await fetch(`${SEARCH_BASE}/${corpus}.json?${params}`, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!res.ok) {
    throw new Error(`네이버 ${corpus} 검색 오류: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    total?: number;
    items?: { title: string; postdate?: string }[];
  };
  const items = json.items ?? [];

  return {
    corpus,
    query,
    titles: items.map((i) => stripHtml(i.title)),
    // postdate는 'YYYYMMDD' 형식으로 온다
    postDates: items
      .map((i) => i.postdate)
      .filter((d): d is string => !!d && /^\d{8}$/.test(d))
      .map((d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`),
    total: json.total ?? 0,
  };
}

export interface MentionTrend {
  keyword: string;
  /** 최근 7일간 올라온 글 수 */
  recentCount: number;
  /** 그 이전 7일간 올라온 글 수 */
  previousCount: number;
  /** 증가율(%). 이전 기간이 0이면 null */
  growthRate: number | null;
  /** 실제로 확보한 기간(일). 14일에 못 미치면 신뢰도가 낮다 */
  windowDays: number;
  /** 훑어본 글 수 */
  postsScanned: number;
  /** 소모한 API 호출 수 */
  apiCalls: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 키워드의 "언급 속도 변화"를 측정한다 — 진짜 트렌드 신호.
 *
 * 왜 이게 필요한가:
 *   제목에서 단어가 몇 번 나왔는지 세는 것만으로는 "화제"와 "흔함"을 구분할 수 없다.
 *   '소금빵'이 7번 나온 게 많은 건지 적은 건지 알 수 없기 때문이다.
 *   진짜 신호는 "평소 2건이던 게 이번 주에 12건이 됐다"는 변화량이다.
 *
 * 어떻게 가능한가:
 *   네이버 블로그 검색 응답에 postdate(게시 날짜)가 들어온다.
 *   최신순으로 긁어서 날짜별로 세면 일별 게시량이 나온다.
 *   start 파라미터로 최대 1,000개까지 거슬러 올라갈 수 있어서,
 *   과거 데이터를 쌓아두지 않아도 오늘 바로 계산할 수 있다.
 *
 * 한계:
 *   아주 인기 있는 키워드는 1,000개가 며칠치밖에 안 될 수 있다.
 *   그 경우 windowDays가 14 미만으로 나오므로 호출부에서 감안해야 한다.
 */
export async function measureMentionTrend(
  keyword: string,
  maxPages = 10 // API 상한(start<=1000)까지. 검색 API는 하루 25,000회라 여유롭다
): Promise<MentionTrend> {
  const dates: string[] = [];
  let apiCalls = 0;

  const today = new Date();
  const cutoff = new Date(today.getTime() - 14 * MS_PER_DAY);

  for (let page = 0; page < maxPages; page++) {
    const start = page * 100 + 1;
    if (start > 1000) break; // API 상한

    const result = await searchNaver(keyword, 'blog', 100, start);
    apiCalls += 1;
    dates.push(...result.postDates);

    if (result.postDates.length === 0) break; // 더 없음

    // 가장 오래된 글이 14일 이전이면 필요한 구간을 다 덮은 것
    const oldest = result.postDates[result.postDates.length - 1];
    if (new Date(oldest) < cutoff) break;
  }

  const recentCutoff = new Date(today.getTime() - 7 * MS_PER_DAY);
  const previousCutoff = new Date(today.getTime() - 14 * MS_PER_DAY);

  let recentCount = 0;
  let previousCount = 0;
  let oldestSeen: Date | null = null;

  for (const d of dates) {
    const date = new Date(d);
    if (!oldestSeen || date < oldestSeen) oldestSeen = date;
    if (date >= recentCutoff) recentCount += 1;
    else if (date >= previousCutoff) previousCount += 1;
  }

  const windowDays = oldestSeen
    ? Math.round((today.getTime() - oldestSeen.getTime()) / MS_PER_DAY)
    : 0;

  /**
   * 증가율은 아래 두 조건을 모두 만족할 때만 낸다.
   *
   *  1) 14일 구간을 실제로 덮었을 것 (windowDays >= 14)
   *     인기 키워드는 1,000건이 며칠치밖에 안 돼 이전 7일에 도달하지 못한다.
   *     그 경우 previousCount가 0이 되어 "무한 증가"처럼 보이는데, 사실은
   *     데이터가 없는 것이다.
   *
   *  2) 표본이 최소한은 될 것 (양쪽 합계 >= MIN_SAMPLE)
   *     글 5건으로 계산한 "+66.7%"는 노이즈다. 값을 만들어내느니 null이 낫다.
   *
   * 7일 단위로 비교하는 이유는 요일 효과 때문이다. 블로그 게시량은 주말·평일
   * 편차가 커서, 창 길이가 7의 배수가 아니면 요일이 상쇄되지 않는다.
   */
  const MIN_SAMPLE = 10;
  const sample = recentCount + previousCount;
  const reliable = windowDays >= 14 && sample >= MIN_SAMPLE && previousCount > 0;

  return {
    keyword,
    recentCount,
    previousCount,
    growthRate: reliable
      ? Math.round(((recentCount - previousCount) / previousCount) * 1000) / 10
      : null,
    windowDays,
    postsScanned: dates.length,
    apiCalls,
  };
}
