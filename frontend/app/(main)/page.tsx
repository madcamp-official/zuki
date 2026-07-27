import HeroBanner from "@/components/HeroBanner";
import CategoryNav from "@/components/CategoryNav";
import TrendCard from "@/components/TrendCard";
import RankingList from "@/components/RankingList";
import WhyTrending from "@/components/WhyTrending";
import TodayBriefing from "@/components/TodayBriefing";
import NewsletterCta from "@/components/NewsletterCta";
import { TRENDS } from "@/lib/trends";

const HOT_TRENDS = TRENDS.slice(0, 4);

export default function Home() {
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
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {HOT_TRENDS.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
          <RankingList />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <WhyTrending />
        <TodayBriefing />
      </div>

      <NewsletterCta />
    </div>
  );
}
