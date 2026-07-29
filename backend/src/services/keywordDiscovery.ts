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
 *   1) 유튜브 인기 급상승 영상 제목 (1 unit)
 *   2) 네이버 블로그·카페글 최신 포스트 제목 (하루 25,000회 한도)
 *
 * === 언급 빈도가 핵심 신호다 ===
 *
 * 초기 구현은 추출한 단어를 Set에 넣어 중복을 없앴다. 그러면 제목 1000개에서
 * 30번 나온 '두바이초콜릿'과 1번 나온 '식빵'이 똑같이 후보 1개가 되어,
 * 결과가 "요즘 화제"가 아니라 "어디에나 있는 메뉴 목록"이 되어버린다.
 *
 * 그래서 등장 횟수(mentionCount)를 함께 센다.
 * "최근 글에 자주 나오는데 검색량은 아직 낮다"가 태동기의 신호이기 때문이다.
 */

import { NaverSearchCorpus, searchNaver } from './naverSearch';
import { discoverVideosByQuery } from './youtubeApi';

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

/**
 * 짧고 흔한 형태 단어는 가게 이름에도 자주 쓰인다(천하제빵, 더벤티, 탄티).
 * 이런 형태로 끝나는 토큰은 앞부분이 충분히 길 때만 인정한다.
 */
const SHORT_FORMS = new Set(['티', '빵', '파이', '무스']);
const MIN_PREFIX_FOR_SHORT_FORM = 2;

/** 제목에서 뽑히면 안 되는 흔한 단어들 */
const STOPWORDS = new Set([
  '카페', '디저트', '음료', '메뉴', '신메뉴', '레시피', '만들기', '먹방',
  '리뷰', '추천', '브이로그', '맛집', '오늘', '진짜', '최고', '요즘',
  '집에서', '초간단', '만드는법', '먹어봤다', '후기', '내돈내산', '광고',
  '존맛', '꿀맛', '데일리', '일상', '기록', '방문', '후불', '이벤트',
  '단백질쉐이크', '후무스', '식빵', '흰빵', '밥빵',
]);

/**
 * 프랜차이즈·유명 가게 이름 — 형태 단어로 끝나서 걸리지만 메뉴가 아니다.
 * 사장님이 알고 싶은 건 "그 가게 이름"이 아니라 "그 가게에서 뜨는 디저트"다.
 */
const BRAND_NAMES = new Set([
  '더벤티', '메가커피', '컴포즈커피', '빽다방', '이디야', '투썸플레이스',
  '할리스', '엔제리너스', '탐앤탐스', '파스쿠찌', '커피빈', '폴바셋',
  '천하제빵', '성심당', '뚜레쥬르', '파리바게뜨', 'london베이글',
  '런던베이글', '노티드', '아우어베이커리', '탄티', '공차', '쥬씨',
]);

/**
 * 지역명 — '창원소금빵'처럼 앞에 붙으면 벗겨내고,
 * '서울빵'처럼 벗기고 나면 형태 단어만 남는 경우는 버린다.
 */
const REGION_PREFIXES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  '수원', '성남', '용인', '고양', '창원', '청주', '천안', '전주', '포항',
  '김해', '평택', '안산', '안양', '남양주', '화성', '제천', '강남', '홍대',
  '연남', '성수', '망원', '이태원', '건대', '신촌', '잠실', '해운대',
];

/**
 * 네이버 블로그·카페에서 검색할 쿼리 — 신상/유행 이야기가 모이는 표현 위주.
 *
 * 편의점 신상을 포함하는 이유: 국내 디저트·음료 유행은 편의점에서 먼저
 * 터지고 카페로 넘어오는 경우가 많다(두바이초콜릿이 대표적). 카페 쪽만
 * 보면 이미 확산된 뒤에야 잡히므로, 선행 지표로 함께 훑는다.
 */
export const NAVER_DISCOVERY_QUERIES = [
  '카페 신메뉴',
  '요즘 유행 디저트',
  '신상 디저트',
  '베이커리 신상',
  '카페 신상 음료',
  '편의점 신메뉴',
  '편의점 신상 디저트',
];

/**
 * 유튜브 검색 쿼리. 쿼리당 101 unit이라 네이버(1회당 1건)보다 적게 쓴다.
 * 4개 쿼리 = 404 unit (하루 10,000 중 4%).
 */
export const YOUTUBE_DISCOVERY_QUERIES = [
  '카페 신메뉴',
  '요즘 유행 디저트',
  '신상 디저트 리뷰',
  '편의점 신상',
];

/**
 * 발굴 소스 — 교차 검증을 위해 개별로 구분한다.
 *
 * 어떤 소스도 편향이 있다. 블로그는 체험단·협찬이 많고, 카페글은 카페별로
 * 연령대가 갈리며, 유튜브는 채널 구독자층이 다르다. 한 소스에서만 잡힌
 * 키워드는 그 소스의 편향일 수 있으므로, 여러 소스에서 동시에 잡힌 것을
 * 더 신뢰한다. 개인 카페·빵집 이름이 대개 블로그 한 곳에서만 나온다는
 * 점에서 가게 이름 노이즈도 함께 걸러진다.
 */
export type DiscoverySource = 'blog' | 'cafe' | 'youtube';

export interface DiscoveredKeyword {
  keyword: string;
  source: DiscoverySource;
  /** 훑어본 제목들에서 몇 번 등장했는지 */
  mentionCount: number;
}

export interface DiscoveryAttempt {
  target: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface DiscoveryResult {
  keywords: DiscoveredKeyword[];
  /** 훑어본 제목 수 — 0이면 API 호출 자체가 실패했다는 뜻 */
  titlesScanned: number;
  attempts: DiscoveryAttempt[];
}

/**
 * 토큰 하나가 유효한 메뉴 키워드인지 판정하고, 필요하면 정규화해서 돌려준다.
 * 유효하지 않으면 null.
 */
export function normalizeKeyword(rawToken: string): string | null {
  let token = rawToken;

  if (token.length < 2 || token.length > 20) return null;
  if (STOPWORDS.has(token)) return null;
  if (BRAND_NAMES.has(token)) return null;

  // '창원소금빵' -> '소금빵' : 지역명은 메뉴 이름의 일부가 아니다
  for (const region of REGION_PREFIXES) {
    if (token.startsWith(region) && token.length > region.length + 1) {
      token = token.slice(region.length);
      break;
    }
  }

  // 지역명을 벗기고 나서 다시 검사 ('서울빵' -> '빵'은 형태 단어 그 자체라 탈락)
  if (token.length < 2) return null;
  if (STOPWORDS.has(token) || BRAND_NAMES.has(token)) return null;

  const form = FORMS.find((f) => token.endsWith(f) && token.length > f.length);
  if (!form) return null;

  const prefix = token.slice(0, token.length - form.length);

  // 형태 단어 앞이 지역명 그 자체면 메뉴가 아니라 지역 특산/가게를 가리킨다
  // ('서울빵', '대전빵' X). 위에서 벗기지 못한 짧은 조합이 여기서 걸린다.
  if (REGION_PREFIXES.includes(prefix)) return null;

  // '빵', '티' 같은 짧은 형태는 가게 이름에도 흔하다.
  // 앞에 붙는 말이 2자 이상일 때만 메뉴로 인정한다 ('탄티' X, '밀크티' O)
  if (SHORT_FORMS.has(form) && prefix.length < MIN_PREFIX_FOR_SHORT_FORM) {
    return null;
  }

  return token;
}

/**
 * 제목 목록에서 음식/음료로 보이는 한글 토큰을 추출하고 등장 횟수를 센다.
 *
 * 형태소 분석기 없이 처리하기 위해 "FORMS로 끝나는 토큰"을 고른 뒤,
 * 지역명·브랜드명·짧은 접두어를 걸러낸다. 정밀하진 않지만 오탐이 나와도
 * 다음 단계에서 검색량으로 다시 걸러지므로 실용상 충분하다.
 */
export function extractKeywordsFromTitles(
  titles: string[],
  source: DiscoverySource
): DiscoveredKeyword[] {
  const counts = new Map<string, number>();

  for (const title of titles) {
    // 한글/영문/숫자만 남기고 나머지는 구분자로 취급
    const tokens = title.split(/[^가-힣a-zA-Z0-9]+/).filter(Boolean);

    // 같은 제목에 같은 단어가 반복돼도 1회로 센다 (제목 = 하나의 언급)
    const seenInTitle = new Set<string>();

    for (const token of tokens) {
      const normalized = normalizeKeyword(token);
      if (!normalized || seenInTitle.has(normalized)) continue;
      seenInTitle.add(normalized);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([keyword, mentionCount]) => ({ keyword, source, mentionCount }))
    .sort((a, b) => b.mentionCount - a.mentionCount);
}

/**
 * 유튜브에서 주제 검색으로 후보 키워드를 뽑는다.
 *
 * 인기 급상승 차트(chart=mostPopular)는 1 unit으로 저렴하지만, 한국 유튜브
 * 인기 차트는 음악·예능이 점령하고 있어 카페 디저트 키워드가 사실상 나오지
 * 않는다(실측: 제목 157개에서 0개 추출).
 *
 * 그래서 주제 쿼리로 직접 검색한다. 특정 채널을 골라 넣지 않는 이유는,
 * 고르는 사람의 취향과 그 채널 구독자층의 편향이 그대로 들어가기 때문이다.
 * 검색으로 매번 새로 뽑으면 지금 이 주제에서 조회수가 잘 나오는 영상이
 * 자연스럽게 올라오고, 유행이 바뀌면 구성도 알아서 바뀐다.
 *
 * 비용: 쿼리당 101 unit. 기본 3개 쿼리 = 303 unit (하루 10,000 중 3%).
 */
export async function discoverFromYoutube(
  queries: string[] = YOUTUBE_DISCOVERY_QUERIES
): Promise<DiscoveryResult> {
  const titles: string[] = [];
  const attempts: DiscoveryAttempt[] = [];

  for (const query of queries) {
    const target = `youtube:${query}`;
    try {
      const videos = await discoverVideosByQuery(query);
      titles.push(...videos.map((v) => v.title));
      attempts.push({ target, ok: true, count: videos.length });
    } catch (err) {
      attempts.push({
        target,
        ok: false,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    keywords: extractKeywordsFromTitles(titles, 'youtube'),
    titlesScanned: titles.length,
    attempts,
  };
}

/**
 * 네이버 블로그 또는 카페글에서 후보 키워드를 뽑는다.
 *
 * 블로그와 카페를 한 번에 합치지 않고 코퍼스별로 따로 호출하는 이유는,
 * 교차 검증을 하려면 "어느 소스에서 나왔는지"를 구분해야 하기 때문이다.
 *
 * 검색 API는 하루 25,000회라 데이터랩(1,000회)과 별도로 여유롭다.
 */
export async function discoverFromNaver(
  corpus: NaverSearchCorpus = 'blog',
  queries: string[] = NAVER_DISCOVERY_QUERIES
): Promise<DiscoveryResult> {
  const titles: string[] = [];
  const attempts: DiscoveryAttempt[] = [];

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

  return {
    keywords: extractKeywordsFromTitles(titles, corpus === 'blog' ? 'blog' : 'cafe'),
    titlesScanned: titles.length,
    attempts,
  };
}
