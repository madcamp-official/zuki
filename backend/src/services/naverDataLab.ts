/**
 * 네이버 데이터랩 검색어트렌드 API 연동 (기획서 11-4 ①)
 * - 엔드포인트: POST https://openapi.naver.com/v1/datalab/search
 * - 인증: 헤더에 X-Naver-Client-Id / X-Naver-Client-Secret
 * - 최대 5개 주제어 그룹, 그룹당 최대 20개 검색어
 * - 응답은 절대 검색량이 아니라 0~100 사이 "상대 지수" (기획서 11-4 주의점)
 * - 키 발급: https://developers.naver.com
 */

const NAVER_DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search';

export interface NaverTrendPoint {
  period: string; // 'YYYY-MM-DD'
  ratio: number; // 0~100 상대 지수
}

export interface NaverTrendResult {
  keyword: string;
  points: NaverTrendPoint[];
}

/**
 * 한 번의 API 호출로 조회 가능한 키워드 수.
 *
 * 네이버 제한은 "최대 5개 주제어 그룹, 그룹당 최대 20개 검색어"인데,
 * 우리는 키워드별로 개별 지수가 필요해서 키워드 1개 = 그룹 1개로 매핑한다.
 * 따라서 실제 상한은 20이 아니라 5다. (이전 코드의 20 체크는 잘못된 값이었음)
 */
export const NAVER_MAX_KEYWORDS_PER_CALL = 5;

/**
 * 후보 키워드들의 최근 N개월 검색어트렌드 지수를 조회한다.
 * 한 번에 최대 5개까지. 그 이상은 fetchNaverTrendsBatched를 쓸 것.
 */
export async function fetchNaverTrends(
  keywords: string[],
  months = 3
): Promise<NaverTrendResult[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않았습니다.');
  }
  if (keywords.length === 0) return [];
  if (keywords.length > NAVER_MAX_KEYWORDS_PER_CALL) {
    throw new Error(
      `네이버 데이터랩은 한 번에 최대 ${NAVER_MAX_KEYWORDS_PER_CALL}개 그룹까지만 지원합니다. ` +
        `(요청: ${keywords.length}개) fetchNaverTrendsBatched를 사용하세요.`
    );
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const body = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    timeUnit: 'date',
    keywordGroups: keywords.map((kw) => ({ groupName: kw, keywords: [kw] })),
  };

  const res = await fetch(NAVER_DATALAB_URL, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`네이버 데이터랩 API 오류: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    results: { title: string; data: { period: string; ratio: number }[] }[];
  };

  return json.results.map((r) => ({
    keyword: r.title,
    points: r.data.map((d) => ({ period: d.period, ratio: d.ratio })),
  }));
}

/**
 * 키워드를 5개씩 묶어 여러 번 호출한다.
 *
 * 네이버 데이터랩은 하루 1,000회 호출 제한이 있고 호출당 5개까지 담을 수 있어서,
 * 이론상 하루 5,000개 키워드까지 감시 가능하다. (유튜브는 키워드당 101 unit이라
 * 하루 ~99개가 한계 — 그래서 후보 키워드 폭넓은 감시는 네이버만으로 한다)
 *
 * 일부 묶음이 실패해도 나머지는 살리기 위해 묶음 단위로 에러를 잡는다.
 */
export async function fetchNaverTrendsBatched(
  keywords: string[],
  months = 3
): Promise<{ results: NaverTrendResult[]; failed: { keywords: string[]; message: string }[] }> {
  const results: NaverTrendResult[] = [];
  const failed: { keywords: string[]; message: string }[] = [];

  for (let i = 0; i < keywords.length; i += NAVER_MAX_KEYWORDS_PER_CALL) {
    const chunk = keywords.slice(i, i + NAVER_MAX_KEYWORDS_PER_CALL);
    try {
      results.push(...(await fetchNaverTrends(chunk, months)));
    } catch (err) {
      failed.push({
        keywords: chunk,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, failed };
}
