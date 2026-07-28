/**
 * 후보 키워드 발굴 (discovery)
 *
 * 왜 필요한가:
 *   네이버 데이터랩 검색어트렌드 API는 "이 키워드가 얼마나 뜨나?"에만 답한다.
 *   키워드를 먼저 줘야 지수를 돌려주는 구조라서, "뭐가 뜨고 있나?"는 알 수 없다.
 *   그래서 감시할 후보 키워드 목록을 별도로 만들어내는 단계가 필요하다.
 *
 * 두 가지 방법을 쓴다:
 *   1) 유튜브 인기 급상승 영상 제목에서 디저트/음료 관련 단어 추출
 *      - videos.list(chart=mostPopular)는 1 unit밖에 안 든다 (search.list는 100 unit)
 *      - 실제로 지금 사람들이 보고 있는 콘텐츠 기반이라 신선도가 높다
 *   2) 재료 × 형태 조합 생성
 *      - 외부 API 없이 만들 수 있고, 유행이 "새 재료 + 익숙한 형태"로 오는 경우가 많다
 *        (흑임자 라떼, 두바이 초콜릿, 소금 빵 …)
 *      - 대부분은 검색량 0으로 걸러지고, 살아남는 게 후보가 된다
 *
 * 두 방법 모두 아래 FORMS(형태) 어휘를 공유한다.
 */

/** 디저트/음료의 "형태" — 조합 생성과 제목 추출 양쪽에서 기준이 된다 */
const FORMS = [
  '라떼', '아메리카노', '에이드', '스무디', '프라페', '티', '주스', '쉐이크',
  '케이크', '롤케이크', '치즈케이크', '타르트', '마카롱', '쿠키', '스콘',
  '크루아상', '크로플', '베이글', '도넛', '마들렌', '휘낭시에', '푸딩',
  '빵', '토스트', '파이', '무스', '젤라또', '아이스크림', '빙수', '초콜릿',
];

/** 유행을 만드는 "재료/컨셉" — 계절·수입 트렌드에 따라 갱신 필요 */
const INGREDIENTS = [
  '말차', '흑임자', '피스타치오', '두바이', '얼그레이', '흑당', '소금',
  '딸기', '무화과', '복숭아', '망고', '레몬', '자몽', '청포도', '블루베리',
  '바닐라', '카라멜', '헤이즐넛', '티라미수', '오레오', '인절미', '단호박',
  '고구마', '밤', '쑥', '유자', '히비스커스', '초당옥수수', '바스크', '리얼',
];

/** 마케팅 카테고리는 조합보다 정해진 표현이 많아 별도로 둔다 */
const MARKETING_SEEDS = [
  '카페 굿즈', '카페 이벤트', '인생네컷', '카페 브이로그', '포토존',
  '스탬프 이벤트', '리유저블컵', '팝업스토어', '콜라보 카페', '시즌 한정',
];

/** 제목에서 뽑히면 안 되는 흔한 단어들 */
const STOPWORDS = new Set([
  '카페', '디저트', '음료', '메뉴', '신메뉴', '레시피', '만들기', '먹방',
  '리뷰', '추천', '브이로그', '맛집', '오늘', '진짜', '최고', '요즘',
  '집에서', '초간단', '만드는법', '먹어봤다', '후기',
]);

export interface DiscoveredKeyword {
  keyword: string;
  /** 어디서 나왔는지 — 나중에 어느 방법이 잘 먹히는지 판단하는 근거 */
  source: 'youtube' | 'seed';
}

/**
 * 유튜브 인기 급상승 영상 제목에서 후보 키워드를 뽑는다.
 *
 * 형태소 분석기 없이 처리하기 위해, "FORMS로 끝나는 토큰"만 골라낸다.
 * 예) "흑임자라떼 만들기" -> '흑임자라떼' (라떼로 끝남) O
 *     "오늘 뭐 먹지"      -> 해당 없음                    X
 * 정밀하진 않지만 오탐이 나와도 네이버 검색량 0으로 걸러지므로 실용상 충분하다.
 *
 * 비용: videos.list 1회당 1 unit. 카테고리별로 몇 번 불러도 부담 없다.
 */
export async function discoverFromYoutube(
  categoryIds: string[] = ['26', '24', '22'] // 26=Howto&Style, 24=Entertainment, 22=People&Blogs
): Promise<DiscoveredKeyword[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');
  }

  const titles: string[] = [];

  for (const categoryId of categoryIds) {
    const params = new URLSearchParams({
      part: 'snippet',
      chart: 'mostPopular',
      regionCode: 'KR',
      videoCategoryId: categoryId,
      maxResults: '50',
      key: apiKey,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) {
      // 특정 카테고리가 실패해도 나머지는 계속 진행
      console.warn(`[discovery] 유튜브 카테고리 ${categoryId} 조회 실패: ${res.status}`);
      continue;
    }
    const json = (await res.json()) as { items: { snippet: { title: string } }[] };
    titles.push(...json.items.map((i) => i.snippet.title));
  }

  return extractKeywordsFromTitles(titles);
}

/** 제목 목록에서 FORMS로 끝나는 한글 토큰을 추출 (테스트하기 쉽도록 분리) */
export function extractKeywordsFromTitles(titles: string[]): DiscoveredKeyword[] {
  const found = new Set<string>();

  for (const title of titles) {
    // 한글/영문/숫자만 남기고 나머지는 구분자로 취급
    const tokens = title.split(/[^가-힣a-zA-Z0-9]+/).filter(Boolean);

    for (const token of tokens) {
      if (token.length < 2 || token.length > 20) continue;
      if (STOPWORDS.has(token)) continue;
      // FORMS로 끝나되, 형태 단어 그 자체만인 경우는 제외 ('라떼' X, '흑임자라떼' O)
      const matched = FORMS.find((f) => token.endsWith(f) && token.length > f.length);
      if (matched) found.add(token);
    }
  }

  return [...found].map((keyword) => ({ keyword, source: 'youtube' as const }));
}

/**
 * 재료 × 형태 조합으로 후보 키워드를 생성한다.
 *
 * 30 × 30 = 900개까지 나오지만 대부분 검색량 0이다. 네이버는 호출당 5개씩
 * 하루 1,000회(=5,000개)까지 가능하므로 전량 스크리닝해도 할당량에 여유가 있다.
 * 다만 실행 시간이 길어지므로 limit으로 상한을 둔다.
 */
export function generateSeedKeywords(limit = 300): DiscoveredKeyword[] {
  const out: string[] = [...MARKETING_SEEDS];

  for (const ing of INGREDIENTS) {
    for (const form of FORMS) {
      out.push(`${ing}${form}`);
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }

  return out.slice(0, limit).map((keyword) => ({ keyword, source: 'seed' as const }));
}
