import HeroBanner from "@/components/HeroBanner";
import CategoryNav from "@/components/CategoryNav";
import TrendCard from "@/components/TrendCard";
import RankingList from "@/components/RankingList";
import WhyTrending from "@/components/WhyTrending";
import TodayBriefing from "@/components/TodayBriefing";
import NewsletterCta from "@/components/NewsletterCta";
import { fetchTrendById, fetchTrends } from "@/lib/api";

export default async function Home() {
  const trends = await fetchTrends({ limit: 10 });
  const hotTrends = trends.slice(0, 4);
  const topTrendDetail = hotTrends[0]
    ? await fetchTrendById(hotTrends[0].id)
    : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-7 sm:px-6">
      <HeroBanner />

      <CategoryNav />

      <section className="rounded-[28px] border border-[#f4e3d7] bg-white/45 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-heading text-xl text-dark">
            이번 주 HOT 트렌드 <span aria-hidden>🔥</span>
          </h2>
          <div className="flex gap-2">
            <button
              aria-label="이전 트렌드"
              className="grid h-8 w-8 place-items-center rounded-full bg-white text-gray-400 shadow-sm transition-colors hover:text-strawberry"
            >
              ←
            </button>
            <button
              aria-label="다음 트렌드"
              className="grid h-8 w-8 place-items-center rounded-full bg-white text-gray-400 shadow-sm transition-colors hover:text-strawberry"
            >
              →
            </button>
          </div>
        </div>
        {hotTrends.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            아직 등록된 트렌드가 없어요
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {hotTrends.map((trend) => (
                <TrendCard key={trend.id} trend={trend} />
              ))}
            </div>
            <RankingList trends={trends} />
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <WhyTrending trend={topTrendDetail?.trend} />
        <TodayBriefing trends={trends.slice(0, 5)} />
      </div>

      <NewsletterCta />
    </div>
  );
}
