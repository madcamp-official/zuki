import type { TrendStatus } from "@/components/StatusBadge";

export type CategorySlug = "dessert" | "drink" | "marketing";

export interface TrendItem {
  id: string;
  rank: number;
  title: string;
  category: CategorySlug;
  status: TrendStatus;
  image: string;
  /** 홈 히어로 배너 전용 이미지 (1위일 때만 존재) */
  bannerImage?: string | null;
  searchGrowth: number;
  mentionGrowth: number;
  regionScope: string;
  why: string[];
  searchTrend: number[];
}

const MONTH_LABELS = ["2월", "3월", "4월", "5월", "6월", "7월"];

export { MONTH_LABELS };

export const TRENDS: TrendItem[] = [
  {
    id: "strawberry-cream-brioche",
    rank: 1,
    title: "딸기 크림 브리오슈",
    category: "dessert",
    status: "상승기",
    image:
      "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=900&q=80",
    searchGrowth: 78,
    mentionGrowth: 63,
    regionScope: "전국 확산 중 (수도권 → 지방 순)",
    why: [
      "인스타그램 릴스 게시물 3배 증가",
      "유튜브 쇼츠 언급량 급상승",
      "봄 시즌 딸기 수요 증가",
      "유명 카페 신메뉴 출시 잇따라",
    ],
    searchTrend: [12, 18, 29, 47, 62, 78],
  },
  {
    id: "matcha-cream-roll",
    rank: 2,
    title: "말차 생크림 롤케이크",
    category: "dessert",
    status: "전성기",
    image:
      "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=900&q=80",
    searchGrowth: 65,
    mentionGrowth: 47,
    regionScope: "전국 고르게 확산",
    why: [
      "말차 원재료 가격 안정화로 매장 도입 증가",
      "일본 여행 인구 증가로 현지 디저트 노출↑",
      "저당 디저트 선호 트렌드와 맞물림",
    ],
    searchTrend: [40, 52, 61, 70, 68, 65],
  },
  {
    id: "salted-butter-pretzel",
    rank: 3,
    title: "소금버터 프레즐",
    category: "dessert",
    status: "상승기",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=80",
    searchGrowth: 52,
    mentionGrowth: 38,
    regionScope: "대전·충청권 베이커리 중심 확산",
    why: [
      "대전 지역 베이커리 신메뉴로 다수 등장",
      "짠단 조합 디저트 선호 지속",
      "포장·선물용 수요 증가",
    ],
    searchTrend: [8, 14, 22, 33, 44, 52],
  },
  {
    id: "vanilla-cream-latte",
    rank: 4,
    title: "바닐라 크림 라떼",
    category: "drink",
    status: "상승기",
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=900&q=80",
    searchGrowth: 41,
    mentionGrowth: 27,
    regionScope: "전국 확산 중",
    why: [
      "여름 시즌 진입으로 크림 음료 수요 증가",
      "유명 프랜차이즈 시즌 메뉴 출시 영향",
    ],
    searchTrend: [15, 19, 24, 30, 36, 41],
  },
  {
    id: "ribbon-cake",
    rank: 5,
    title: "리본 케이크",
    category: "dessert",
    status: "상승기",
    image:
      "https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=900&q=80",
    searchGrowth: 39,
    mentionGrowth: 21,
    regionScope: "서울·수도권 중심",
    why: ["기념일 시즌 선물용 케이크 수요 증가", "SNS 비주얼 콘텐츠로 확산"],
    searchTrend: [10, 16, 21, 27, 33, 39],
  },
  {
    id: "sweetcorn-cream-latte",
    rank: 6,
    title: "초당옥수수 크림라떼",
    category: "drink",
    status: "태동기",
    image:
      "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=900&q=80",
    searchGrowth: 34,
    mentionGrowth: 18,
    regionScope: "제주·남부 지방에서 시작",
    why: ["초당옥수수 제철 수확 시기 도래", "이색 음료 콘텐츠 인기 증가"],
    searchTrend: [4, 7, 12, 19, 26, 34],
  },
  {
    id: "black-sesame-cream-latte",
    rank: 7,
    title: "흑임자 크림라떼",
    category: "drink",
    status: "태동기",
    image:
      "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=900&q=80",
    searchGrowth: 32,
    mentionGrowth: 15,
    regionScope: "전국 소규모 확산",
    why: ["건강 지향 음료 선호 증가", "전통 재료 재해석 트렌드"],
    searchTrend: [6, 9, 14, 20, 26, 32],
  },
  {
    id: "yogurt-icecream",
    rank: 8,
    title: "요거트 아이스크림",
    category: "dessert",
    status: "태동기",
    image:
      "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=900&q=80",
    searchGrowth: 29,
    mentionGrowth: 12,
    regionScope: "여름 성수기 앞두고 전국 확산 조짐",
    why: ["여름 성수기 진입", "저당·건강 디저트 선호"],
    searchTrend: [5, 8, 13, 18, 23, 29],
  },
  {
    id: "lettering-cake",
    rank: 9,
    title: "레터링 케이크",
    category: "marketing",
    status: "하락기",
    image:
      "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=900&q=80",
    searchGrowth: 27,
    mentionGrowth: -8,
    regionScope: "전국, 성수기 지남",
    why: ["작년 대비 신선도 하락", "유사 콘텐츠 포화로 SNS 노출 감소"],
    searchTrend: [45, 55, 60, 48, 35, 27],
  },
  {
    id: "strawberry-basque-cheesecake",
    rank: 10,
    title: "딸기 바스크 치즈케이크",
    category: "dessert",
    status: "하락기",
    image:
      "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=900&q=80",
    searchGrowth: 24,
    mentionGrowth: -12,
    regionScope: "전국, 딸기 시즌 종료로 하락 전환",
    why: ["딸기 제철 종료 시기 근접", "바스크 치즈케이크 자체 유행 정점 통과"],
    searchTrend: [50, 62, 58, 45, 32, 24],
  },
];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  dessert: "디저트",
  drink: "음료",
  marketing: "마케팅",
};

export function getTrendById(id: string) {
  return TRENDS.find((trend) => trend.id === id);
}

export function getTrendsByCategory(category: CategorySlug) {
  return TRENDS.filter((trend) => trend.category === category);
}
