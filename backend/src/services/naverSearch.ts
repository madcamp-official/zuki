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
  display = 100
): Promise<NaverSearchResult> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않았습니다.');
  }

  const params = new URLSearchParams({
    query,
    display: String(Math.min(display, 100)), // API 상한 100
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

  const json = (await res.json()) as { items?: { title: string }[] };
  return {
    corpus,
    query,
    titles: (json.items ?? []).map((i) => stripHtml(i.title)),
  };
}
