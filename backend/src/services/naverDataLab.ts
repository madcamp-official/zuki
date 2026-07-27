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
 * 후보 키워드들의 최근 N개월 검색어트렌드 지수를 조회한다.
 * TODO(Day2-3): 실제 응답 파싱 로직은 네이버 API 키 발급 후 응답 예시 보고 확정
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
  if (keywords.length > 20) {
    throw new Error('네이버 데이터랩은 그룹당 최대 20개 검색어까지만 지원합니다.');
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
