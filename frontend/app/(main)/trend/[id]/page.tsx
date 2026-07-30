import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import TrendChart from "@/components/TrendChart";
import TrendCard from "@/components/TrendCard";
import BookmarkButton from "@/components/BookmarkButton";
import { CATEGORY_LABELS } from "@/lib/trends";
import { fetchTrendById, fetchTrends } from "@/lib/api";

export default async function TrendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchTrendById(id);

  if (!result) {
    notFound();
  }

  const { trend, searchHistory } = result;

  const related = (await fetchTrends({ category: trend.category, limit: 5 })).filter(
    (item) => item.id !== trend.id,
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-8">
      <Link href="/category" className="text-sm text-gray-400 hover:text-strawberry">
        ← 카테고리로 돌아가기
      </Link>

      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="relative aspect-square overflow-hidden rounded-3xl">
          <Image
            src={trend.image}
            alt={trend.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col justify-center gap-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={trend.status} />
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-strawberry">
              {CATEGORY_LABELS[trend.category]}
            </span>
          </div>
          <h1 className="font-heading text-3xl text-dark md:text-4xl">
            {trend.title}
          </h1>
          <div className="flex gap-6 text-sm">
            <span>
              검색량{" "}
              <b className="font-number text-strawberry">
                {trend.searchGrowth >= 0 ? "+" : ""}
                {trend.searchGrowth}%
              </b>
            </span>
          </div>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-dark">확산 지역</span>{" "}
            {trend.regionScope}
          </p>
          <BookmarkButton trendId={trend.id} />
        </div>
      </div>

      <section className="rounded-[28px] border border-[#f1dfd3] bg-white p-6 shadow-[0_14px_34px_rgba(139,62,35,.05)]">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-heading text-2xl text-dark">검색량 추이 <span aria-hidden>📈</span></h2>
        <p className="mt-1 text-xs text-gray-400">네이버 데이터랩 기준 상대 검색지수 · 최근 변동 폭을 확대해 보여드려요</p></div>
        <span className="rounded-full bg-[#fff2f3] px-3 py-1.5 text-xs font-bold text-strawberry">트렌드 모멘텀 분석</span></div>
        <div className="mt-4">
          {/* scoreHistory(점수 이력)가 아니라 일별 검색지수를 쓴다 —
              화면 라벨이 "네이버 데이터랩 기준 상대 검색지수(0~100)"이므로 이 값이 맞다 */}
          <TrendChart data={searchHistory.values} labels={searchHistory.labels} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl text-dark">
          왜 이 트렌드가 뜨고 있을까요?
        </h2>
        {trend.why.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            아직 등록된 배경 설명이 없어요
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2 text-sm text-gray-600">
            {trend.why.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="text-strawberry" aria-hidden>
                  ✅
                </span>
                {reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-xl text-dark">
            {CATEGORY_LABELS[trend.category]} 카테고리의 다른 트렌드
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((item) => (
              <TrendCard key={item.id} trend={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
