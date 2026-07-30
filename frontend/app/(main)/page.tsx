import HeroBanner from "@/components/HeroBanner";
import CategoryNav from "@/components/CategoryNav";
import FeedCard from "@/components/FeedCard";
import RankingList from "@/components/RankingList";
import WhyTrending from "@/components/WhyTrending";
import NewsletterCta from "@/components/NewsletterCta";
import { fetchTrendById, fetchTrends } from "@/lib/api";

export default async function Home() {
  const trends = await fetchTrends({ limit: 10 });
  const feedTrends = trends.slice(0, 6);
  const topTrendDetail = feedTrends[0]
    ? await fetchTrendById(feedTrends[0].id)
    : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-7 sm:px-6">
      <HeroBanner trends={feedTrends.slice(0, 4)} />

      <CategoryNav />

      <WhyTrending trend={topTrendDetail?.trend} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <section className="flex flex-col gap-5">
          <h2 className="flex items-center gap-1.5 font-heading text-2xl text-dark">
            이번 주 HOT 트렌드 <span aria-hidden>🔥</span>
          </h2>

          {feedTrends.length === 0 ? (
            <p className="rounded-[28px] border border-[#f1dfd3] bg-[#fffdf9] py-16 text-center text-sm text-gray-400">
              아직 등록된 트렌드가 없어요
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {feedTrends.map((trend) => (
                <FeedCard key={trend.id} trend={trend} />
              ))}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-20">
          <RankingList trends={trends} />
        </aside>
      </div>

      <NewsletterCta />
    </div>
  );
}
