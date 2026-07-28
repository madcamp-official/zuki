/**
 * 프론트 lib/trends.ts의 목업 10개를 실제 DB에 시드하는 1회성 스크립트.
 * 실행: npx ts-node scripts/seed-trends.ts
 */
import 'dotenv/config';
import { getPool } from '../src/db/client';

const MONTH_LABELS = ['2월', '3월', '4월', '5월', '6월', '7월'];

const CATEGORY_ID: Record<string, number> = {
  dessert: 1,
  drink: 2,
  marketing: 3,
};

const STATUS_MAP: Record<string, string> = {
  태동기: 'emerging',
  상승기: 'rising',
  전성기: 'peak',
  하락기: 'declining',
};

const SEED_TRENDS = [
  {
    title: '딸기 크림 브리오슈',
    category: 'dessert',
    status: '상승기',
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=900&q=80',
    score: 78,
    regionScope: '전국 확산 중 (수도권 → 지방 순)',
    reason: [
      '인스타그램 릴스 게시물 3배 증가',
      '유튜브 쇼츠 언급량 급상승',
      '봄 시즌 딸기 수요 증가',
      '유명 카페 신메뉴 출시 잇따라',
    ],
    searchTrend: [12, 18, 29, 47, 62, 78],
  },
  {
    title: '말차 생크림 롤케이크',
    category: 'dessert',
    status: '전성기',
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=900&q=80',
    score: 65,
    regionScope: '전국 고르게 확산',
    reason: [
      '말차 원재료 가격 안정화로 매장 도입 증가',
      '일본 여행 인구 증가로 현지 디저트 노출↑',
      '저당 디저트 선호 트렌드와 맞물림',
    ],
    searchTrend: [40, 52, 61, 70, 68, 65],
  },
  {
    title: '소금버터 프레즐',
    category: 'dessert',
    status: '상승기',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=80',
    score: 52,
    regionScope: '대전·충청권 베이커리 중심 확산',
    reason: [
      '대전 지역 베이커리 신메뉴로 다수 등장',
      '짠단 조합 디저트 선호 지속',
      '포장·선물용 수요 증가',
    ],
    searchTrend: [8, 14, 22, 33, 44, 52],
  },
  {
    title: '바닐라 크림 라떼',
    category: 'drink',
    status: '상승기',
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=900&q=80',
    score: 41,
    regionScope: '전국 확산 중',
    reason: ['여름 시즌 진입으로 크림 음료 수요 증가', '유명 프랜차이즈 시즌 메뉴 출시 영향'],
    searchTrend: [15, 19, 24, 30, 36, 41],
  },
  {
    title: '리본 케이크',
    category: 'dessert',
    status: '상승기',
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=900&q=80',
    score: 39,
    regionScope: '서울·수도권 중심',
    reason: ['기념일 시즌 선물용 케이크 수요 증가', 'SNS 비주얼 콘텐츠로 확산'],
    searchTrend: [10, 16, 21, 27, 33, 39],
  },
  {
    title: '초당옥수수 크림라떼',
    category: 'drink',
    status: '태동기',
    image: 'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=900&q=80',
    score: 34,
    regionScope: '제주·남부 지방에서 시작',
    reason: ['초당옥수수 제철 수확 시기 도래', '이색 음료 콘텐츠 인기 증가'],
    searchTrend: [4, 7, 12, 19, 26, 34],
  },
  {
    title: '흑임자 크림라떼',
    category: 'drink',
    status: '태동기',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=900&q=80',
    score: 32,
    regionScope: '전국 소규모 확산',
    reason: ['건강 지향 음료 선호 증가', '전통 재료 재해석 트렌드'],
    searchTrend: [6, 9, 14, 20, 26, 32],
  },
  {
    title: '요거트 아이스크림',
    category: 'dessert',
    status: '태동기',
    image: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=900&q=80',
    score: 29,
    regionScope: '여름 성수기 앞두고 전국 확산 조짐',
    reason: ['여름 성수기 진입', '저당·건강 디저트 선호'],
    searchTrend: [5, 8, 13, 18, 23, 29],
  },
  {
    title: '레터링 케이크',
    category: 'marketing',
    status: '하락기',
    image: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=900&q=80',
    score: 27,
    regionScope: '전국, 성수기 지남',
    reason: ['작년 대비 신선도 하락', '유사 콘텐츠 포화로 SNS 노출 감소'],
    searchTrend: [45, 55, 60, 48, 35, 27],
  },
  {
    title: '딸기 바스크 치즈케이크',
    category: 'dessert',
    status: '하락기',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=900&q=80',
    score: 24,
    regionScope: '전국, 딸기 시즌 종료로 하락 전환',
    reason: ['딸기 제철 종료 시기 근접', '바스크 치즈케이크 자체 유행 정점 통과'],
    searchTrend: [50, 62, 58, 45, 32, 24],
  },
];

async function main() {
  const pool = getPool();

  for (const seed of SEED_TRENDS) {
    const [trend] = (
      await pool.query(
        `INSERT INTO trends
           (title, summary, category_id, status, score, reason, image_url, region_scope, primary_source, is_published)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, 'editor', true)
         RETURNING id`,
        [
          seed.title,
          CATEGORY_ID[seed.category],
          STATUS_MAP[seed.status],
          seed.score,
          seed.reason.join('\n'),
          seed.image,
          seed.regionScope,
        ],
      )
    ).rows;

    const trendId = trend.id;

    for (let i = 0; i < seed.searchTrend.length; i++) {
      // recorded_date는 유니크 제약 때문에 실제 날짜가 필요 -> 최근 6개월 1일 기준으로 채움
      const monthsAgo = seed.searchTrend.length - 1 - i;
      const date = new Date();
      date.setMonth(date.getMonth() - monthsAgo);
      date.setDate(1);
      const recordedDate = date.toISOString().slice(0, 10);

      await pool.query(
        `INSERT INTO trend_score_history (trend_id, score, status, recorded_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (trend_id, recorded_date) DO UPDATE SET score = EXCLUDED.score`,
        [trendId, seed.searchTrend[i], STATUS_MAP[seed.status], recordedDate],
      );
    }

    console.log(`시드 완료: [${trendId}] ${seed.title} (${MONTH_LABELS.join(',')})`);
  }

  await pool.end();
  console.log(`총 ${SEED_TRENDS.length}개 트렌드 시드 완료`);
}

main().catch((err) => {
  console.error('시드 실패:', err);
  process.exit(1);
});
