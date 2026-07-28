/**
 * 후보 키워드 발굴 (discovery)
 *
 * 왜 필요한가:
 *   네이버 데이터랩 검색어트렌드 API는 "이 키워드가 얼마나 뜨나?"에만 답한다.
 *   키워드를 먼저 줘야 지수를 돌려주는 구조라서, "뭐가 뜨고 있나?"는 알 수 없다.
 *   네이버는 급상승 키워드 목록 API도 제공하지 않는다(실시간 검색어는 2021년 폐지).
 *   그래서 감시할 후보를 실제 콘텐츠에서 찾아내는 단계가 따로 필요하다.
 *
 * 두 소스에서 가져온다 — 둘 다 "지금 실제로 올라오고 있는 콘텐츠"다:
 *   1) 유튜브 인기 급상승 영상 제목
 *      videos.list(chart=mostPopular)는 1 unit밖에 안 든다 (search.list는 100 unit)
 *   2) 네이버 블로그·카페글 최신 포스트 제목
 *      "카페 신메뉴", "디저트 추천" 등으로 검색. 하루 25,000회라 여유롭다
 *
 * 조합 생성(재료 × 형태)은 쓰지 않는다. 우리가 만들어낸 말은 실제로 아무도
 * 검색하지 않는 경우가 대부분이고, 진짜 유행어(예: 두바이초콜릿)는 조합으로
 * 예측할 수 없기 때문이다.
 */

import { NaverSearchCorpus, searchNaver } from './naverSearch';

/**
 * 디저트/음료의 "형태" — 제목에서 키워드를 골라내는 기준.
 * 이 목록으로 키워드를 만들어내는 게 아니라, 실제 제목에 등장한 단어 중
 * 음식/음료로 보이는 것만 추려내는 필터로 쓴다.
 */
const FORMS = [
  '라떼', '아메리카노', '에이드', '스무디', '프라페', '주스', '쉐이크', '티',
  '케이크', '롤케이크', '치즈케이크', '타르트', '마카롱', '쿠키', '스콘',
  '크루아상', '크로플', '베이글', '도넛', '마들렌', '휘낭시에', '푸딩',
  '빵', '토스트', '파이', '무스', '젤라또', '아이스크림', '빙수', '초콜릿',
  '소보로', '단팥', '슈크림', '와플', '팬케이크', '브라우니', '몽블랑',
];

/** 제목에서 뽑히면 안 되는 흔한 단어들 */
const STOPWORDS = new Set([
  '카페', '디저트', '음료', '메뉴', '신메뉴', '레시피', '만들기', '먹방',
  '리뷰', '추천', '브이로그', '맛집', '오늘', '진짜', '최고', '요즘',
  '집에서', '초간단', '만드는법', '먹어봤다', '후기', '내돈내산', '광고',
  '존맛', '꿀맛', '데일리', '일상', '기록', '방문', '후불', '이벤트',
]);

/** 네이버 블로그·카페에서 검색할 쿼리 — 카페/베이커리 신메뉴 이야기가 모이는 표현 */
export const NAVER_DISCOVERY_QUERIES = [
  '카페 신메뉴',
  '디저트 맛집',
  '베이커리 신상',
  '요즘 유행 디저트',
  '카페 신상 음료',
];

export interface DiscoveredKeyword {
  keyword: string;
  /** 어디서 나왔는지 — 어느 소스가 잘 먹히는지 판단하는 근거 */
  source: 'youtube' | 'naver';
}

export interface DiscoveryAttempt {
  target: string;
  ok: boolean;
  /** 가져온 제목 수 */
  count: number;
  error?: string;
}

export interface DiscoveryResult {
  keywords: DiscoveredKeyword[];
  /** 훑어본 제목 수 — 0이면 API 호출 자체가 실패했다는 뜻 */
  titlesScanned: number;
  /** 소스별 성공/실패 내역. 조용히 실패하지 않도록 호출부에 그대로 전달한다 */
  attempts: DiscoveryAttempt[];
}

/**
 * 제목 목록에서 음식/음료로 보이는 한글 토큰을 추출한다.
 *
 * 형태소 분석기 없이 처리하기 위해, "FORMS로 끝나는 토큰"만 골라낸다.
 *   "흑임자라떼 만들기" -> '흑임자라떼' (라떼로 끝남)  O
 *   "오늘 뭐 먹지"       -> 해당 없음                  X
 *   "라떼 한 잔"         -> 형태 단어 그 자체라 제외    X
 *
 * 정밀하진 않지만 오탐이 나와도 네이버 검색량 0으로 걸러지므로 실용상 충분하다.
 */
export function extractKeywordsFromTitles(
  titles: string[],
  source: DiscoveredKeyword['source']
): DiscoveredKeyword[] {
  const found = new Set<string>();

  for (const title of titles) {
    // 한글/영문/숫자만 남기고 나머지는 구분자로 취급
    const tokens = title.split(/[^가-힣a-zA-Z0-9]+/).filter(Boolean);

    for (const token of tokens) {
      if (token.length < 2 || token.length > 20) continue;
      if (STOPWORDS.has(token)) continue;
      const matched = FORMS.find((f) => token.endsWith(f) && token.length > f.length);
      if (matched) found.add(token);
    }
  }

  return [...found].map((keyword) => ({ keyword, source }));
}

/**
 * 유튜브 인기 급상승 영상 제목에서 후보 키워드를 뽑는다.
 * 비용: videos.list 1회당 1 unit.
 *
 * 카테고리를 지정하면 YouTube가 거절하는 경우가 있어(mostPopular 차트 미지원 카테고리),
 * 카테고리 없는 전체 인기 영상을 먼저 확보해 최소한의 결과를 보장한다.
 */
export async function discoverFromYoutube(
  categoryIds: string[] = ['26', '24', '22'] // 26=Howto&Style, 24=Entertainment, 22=People&Blogs
): Promise<DiscoveryResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');
  }

  const titles: string[] = [];
  const attempts: DiscoveryAttempt[] = [];

  async function fetchChart(categoryId?: string): Promise<void> {
    const target = `youtube:${categoryId ?? 'all'}`;
    const params = new URLSearchParams({
      part: 'snippet',
      chart: 'mostPopular',
      regionCode: 'KR',
      maxResults: '50',
      key: apiKey!,
    });
    if (categoryId) params.set('videoCategoryId', categoryId);

    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
      if (!res.ok) {
        // 응답 본문에 실제 사유가 들어있다
        attempts.push({
          target,
          ok: false,
          count: 0,
          error: `${res.status} ${(await res.text()).slice(0, 200)}`,
        });
        return;
      }
      const json = (await res.json()) as { items?: { snippet: { title: string } }[] };
      const got = (json.items ?? []).map((i) => i.snippet.title);
      titles.push(...got);
      attempts.push({ target, ok: true, count: got.length });
    } catch (err) {
      attempts.push({
        target,
        ok: false,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await fetchChart();
  for (const categoryId of categoryIds) {
    await fetchChart(categoryId);
  }

  return {
    keywords: extractKeywordsFromTitles(titles, 'youtube'),
    titlesScanned: titles.length,
    attempts,
  };
}

/**
 * 네이버 블로그·카페글 최신 포스트 제목에서 후보 키워드를 뽑는다.
 *
 * 검색 API는 하루 25,000회라 데이터랩(1,000회)과 별도로 여유롭게 쓸 수 있다.
 * 쿼리 5개 × 코퍼스 2개 = 10회 호출로 최대 1,000개 제목을 훑는다.
 */
export async function discoverFromNaver(
  queries: string[] = NAVER_DISCOVERY_QUERIES,
  corpora: NaverSearchCorpus[] = ['blog', 'cafearticle']
): Promise<DiscoveryResult> {
  const titles: string[] = [];
  const attempts: DiscoveryAttempt[] = [];

  for (const corpus of corpora) {
    for (const query of queries) {
      const target = `naver:${corpus}:${query}`;
      try {
        const result = await searchNaver(query, corpus, 100);
        titles.push(...result.titles);
        attempts.push({ target, ok: true, count: result.titles.length });
      } catch (err) {
        attempts.push({
          target,
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return {
    keywords: extractKeywordsFromTitles(titles, 'naver'),
    titlesScanned: titles.length,
    attempts,
  };
}
