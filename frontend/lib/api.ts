import type { TrendStatus } from "@/components/StatusBadge";
import type { CategorySlug, TrendItem } from "@/lib/trends";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=900&q=80";

const STATUS_MAP: Record<string, TrendStatus> = {
  emerging: "태동기",
  rising: "상승기",
  peak: "전성기",
  declining: "하락기",
};

// 백엔드 categories.slug와 프론트 카테고리 슬러그 표기가 다른 지점만 매핑
const CATEGORY_SLUG_MAP: Record<string, CategorySlug> = {
  dessert: "dessert",
  beverage: "drink",
  marketing: "marketing",
};

interface RawTrend {
  id: number | string;
  title: string;
  summary?: string | null;
  reason?: string | null;
  status: string;
  score: string | number;
  image_url?: string | null;
  region_scope: string;
  category_name: string;
  category_slug: string;
  created_at: string;
}

interface RawScoreHistoryPoint {
  score: string | number;
  status: string;
  recorded_date: string;
}

function toTrendItem(raw: RawTrend, index: number): TrendItem {
  const score = Math.round(Number(raw.score));

  return {
    id: String(raw.id),
    rank: index + 1,
    title: raw.title,
    category: CATEGORY_SLUG_MAP[raw.category_slug] ?? "dessert",
    status: STATUS_MAP[raw.status] ?? "태동기",
    image: raw.image_url || PLACEHOLDER_IMAGE,
    searchGrowth: score,
    // 백엔드에 아직 언급량 지표가 없어 검색량 기반으로 임시 표시
    mentionGrowth: score,
    regionScope: raw.region_scope,
    why: raw.reason ? raw.reason.split("\n").filter(Boolean) : [],
    searchTrend: [],
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API 요청 실패: ${res.status}`);
  }

  return res.json();
}

export async function fetchTrends(params?: {
  category?: CategorySlug;
  status?: string;
  limit?: number;
}): Promise<TrendItem[]> {
  const search = new URLSearchParams();
  if (params?.category) {
    const backendSlug =
      params.category === "drink" ? "beverage" : params.category;
    search.set("category", backendSlug);
  }
  if (params?.status) search.set("status", params.status);
  // 백엔드가 created_at DESC로 자르기 때문에, 정확한 score 랭킹을 뽑으려면
  // 넉넉하게 받아온 뒤 프론트에서 정렬·자르기 (limit=100이 API 상한)
  search.set("limit", "100");

  const query = search.toString();
  const { trends } = await apiFetch<{ trends: RawTrend[] }>(
    `/api/trends?${query}`,
  );

  const sorted = [...trends].sort(
    (a, b) => Number(b.score) - Number(a.score),
  );
  const limited = params?.limit ? sorted.slice(0, params.limit) : sorted;

  return limited.map(toTrendItem);
}

export async function fetchTrendById(id: string): Promise<{
  trend: TrendItem;
  scoreHistory: number[];
} | null> {
  try {
    const { trend, scoreHistory } = await apiFetch<{
      trend: RawTrend;
      scoreHistory: RawScoreHistoryPoint[];
    }>(`/api/trends/${id}`);

    return {
      trend: toTrendItem(trend, 0),
      scoreHistory: scoreHistory.map((point) => Math.round(Number(point.score))),
    };
  } catch {
    return null;
  }
}

export interface CategoryOption {
  id: number;
  name: string;
  slug: CategorySlug;
  sortOrder: number;
}

export async function fetchCategories(): Promise<CategoryOption[]> {
  const { categories } = await apiFetch<{
    categories: { id: number; name: string; slug: string; sort_order: number }[];
  }>("/api/categories");

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: CATEGORY_SLUG_MAP[c.slug] ?? "dessert",
    sortOrder: c.sort_order,
  }));
}
