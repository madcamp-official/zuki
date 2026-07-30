import type { TrendStatus } from "@/components/StatusBadge";
import type { CategorySlug, TrendItem } from "@/lib/trends";
import { createClient } from "@/lib/supabase";

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
  banner_image_url?: string | null;
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

/** 네이버 데이터랩 일별 검색지수 (0~100). "검색량 추이" 그래프용 */
interface RawSearchIndexPoint {
  search_index: string | number;
  recorded_date: string;
}

/**
 * 백엔드 reason은 "문장1. 문장2. 문장3." 형태의 한 문단이라 그대로 두면
 * 불릿 하나에 다 뭉쳐 보인다. 문장 단위로 나눠 각각 불릿으로 보여준다.
 * "117.6%" 같은 소수점은 문장 끝이 아니므로 끊지 않도록 뒤에 공백+대문자/한글이
 * 오는 마침표만 구분자로 삼는다.
 */
function splitReasonIntoSentences(reason: string): string[] {
  return reason
    .split(/\.\s+(?=[^\d])|\.\s*$/)
    .map((s) => s.trim())
    .filter(Boolean);
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
    bannerImage: raw.banner_image_url ?? null,
    searchGrowth: score,
    // 백엔드에 아직 언급량 지표가 없어 검색량 기반으로 임시 표시
    mentionGrowth: score,
    regionScope: raw.region_scope,
    why: raw.reason ? splitReasonIntoSentences(raw.reason) : [],
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

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

/**
 * /api/users/* 는 전부 로그인이 필요해서, Supabase 세션의 access token을
 * Authorization: Bearer 헤더로 실어 보낸다. 세션이 없으면 에러를 던진다.
 */
async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("로그인이 필요합니다.");
  }

  return apiFetch<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });
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
  /** "검색량 추이" 그래프용 — 네이버 데이터랩 일별 검색지수(0~100)와 날짜 라벨 */
  searchHistory: { values: number[]; labels: string[] };
} | null> {
  try {
    const { trend, scoreHistory, searchIndexHistory } = await apiFetch<{
      trend: RawTrend;
      scoreHistory: RawScoreHistoryPoint[];
      searchIndexHistory: RawSearchIndexPoint[];
    }>(`/api/trends/${id}`);

    // 차트 컴포넌트가 균등한 5개 지점을 골라 표시하므로 모든 날짜를 전달한다.
    // 검색량이 극히 적은 롱테일 키워드는 지수가 0~1 사이에 몰려 있어 정수로
    // 반올림하면 전부 0이 되어 그래프가 평평해 보인다. 소수점 둘째 자리까지 유지한다.
    const points = (searchIndexHistory ?? []).map((p) => ({
      value: Math.round(Number(p.search_index) * 100) / 100,
      date: String(p.recorded_date).slice(5, 10).replace("-", "/"), // 'MM/DD'
    }));
    return {
      trend: toTrendItem(trend, 0),
      scoreHistory: scoreHistory.map((point) => Math.round(Number(point.score))),
      searchHistory: { values: points.map((p) => p.value), labels: points.map((p) => p.date) },
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

export interface MyProfile {
  id: string;
  email: string | null;
  storeName: string | null;
  regionSi: string | null;
  regionGu: string | null;
  role: string;
  notifEnabled: boolean;
  categoryInterests: { id: number; name: string; slug: CategorySlug }[];
}

interface RawProfile {
  id: string;
  email: string | null;
  store_name: string | null;
  region_si: string | null;
  region_gu: string | null;
  role: string;
  notif_enabled: boolean;
}

interface RawCategoryInterest {
  id: number;
  name: string;
  slug: string;
}

function toMyProfile(
  user: RawProfile,
  categoryInterests: RawCategoryInterest[],
): MyProfile {
  return {
    id: user.id,
    email: user.email,
    storeName: user.store_name,
    regionSi: user.region_si,
    regionGu: user.region_gu,
    role: user.role,
    notifEnabled: user.notif_enabled,
    categoryInterests: categoryInterests.map((c) => ({
      id: c.id,
      name: c.name,
      slug: CATEGORY_SLUG_MAP[c.slug] ?? "dessert",
    })),
  };
}

/** GET /api/users/me : 로그인 상태면 프로필을, 아니면 null을 반환 */
export async function fetchMyProfile(): Promise<MyProfile | null> {
  try {
    const { user, categoryInterests } = await authFetch<{
      user: RawProfile;
      categoryInterests: RawCategoryInterest[];
    }>("/api/users/me");
    return toMyProfile(user, categoryInterests);
  } catch {
    return null;
  }
}

/** PATCH /api/users/me : 매장명·지역·알림 설정 수정 */
export async function updateMyProfile(params: {
  storeName?: string;
  regionSi?: string;
  regionGu?: string;
  notifEnabled?: boolean;
}): Promise<void> {
  await authFetch("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

/** PUT /api/users/me/category-interests : 관심 카테고리 설정 */
export async function updateMyCategoryInterests(
  categorySlugs: CategorySlug[],
): Promise<void> {
  // 프론트 slug(drink) -> 백엔드 slug(beverage) 역매핑 후 categoryId를 찾아야 하므로
  // 카테고리 목록을 함께 조회한다.
  const categories = await fetchCategories();
  const categoryIds = categorySlugs
    .map((slug) => categories.find((c) => c.slug === slug)?.id)
    .filter((id): id is number => typeof id === "number");

  await authFetch("/api/users/me/category-interests", {
    method: "PUT",
    body: JSON.stringify({ categoryIds }),
  });
}

export interface BookmarkedTrend {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  image: string;
}

/** GET /api/users/me/bookmarks : 즐겨찾기 목록 */
export async function fetchMyBookmarks(): Promise<TrendItem[]> {
  const { bookmarks } = await authFetch<{
    bookmarks: {
      id: number | string;
      title: string;
      summary: string | null;
      status: string;
      score: string | number;
      image_url: string | null;
    }[];
  }>("/api/users/me/bookmarks");

  return bookmarks.map((b, index) => {
    const score = Math.round(Number(b.score));
    return {
      id: String(b.id),
      rank: index + 1,
      title: b.title,
      category: "dessert",
      status: STATUS_MAP[b.status] ?? "태동기",
      image: b.image_url || PLACEHOLDER_IMAGE,
      searchGrowth: score,
      mentionGrowth: score,
      regionScope: "",
      why: b.summary ? [b.summary] : [],
      searchTrend: [],
    };
  });
}

/** POST /api/users/me/bookmarks/:trendId : 즐겨찾기 추가 */
export async function addBookmark(trendId: string): Promise<void> {
  await authFetch(`/api/users/me/bookmarks/${trendId}`, { method: "POST" });
}

/** DELETE /api/users/me/bookmarks/:trendId : 즐겨찾기 해제 */
export async function removeBookmark(trendId: string): Promise<void> {
  await authFetch(`/api/users/me/bookmarks/${trendId}`, { method: "DELETE" });
}
