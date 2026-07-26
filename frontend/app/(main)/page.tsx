import HeroBanner from "@/components/HeroBanner";
import CategoryNav from "@/components/CategoryNav";
import TrendCard, { Trend } from "@/components/TrendCard";
import RankingList from "@/components/RankingList";
import WhyTrending from "@/components/WhyTrending";
import TodayBriefing from "@/components/TodayBriefing";
import NewsletterCta from "@/components/NewsletterCta";

const HOT_TRENDS: Trend[] = [
  {
    rank: 1,
    title: "딸기 크림 브리오슈",
    status: "상승기",
    image:
      "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&q=80",
    searchGrowth: 78,
    mentionGrowth: 63,
  },
  {
    rank: 2,
    title: "말차 생크림 롤케이크",
    status: "전성기",
    image:
      "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&q=80",
    searchGrowth: 65,
    mentionGrowth: 47,
  },
  {
    rank: 3,
    title: "소금버터 프레즐",
    status: "상승기",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80",
    searchGrowth: 52,
    mentionGrowth: 38,
  },
  {
    rank: 4,
    title: "바닐라 크림 라떼",
    status: "상승기",
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=500&q=80",
    searchGrowth: 41,
    mentionGrowth: 27,
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-8">
      <HeroBanner />

      <CategoryNav />

      <section>
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
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {HOT_TRENDS.map((trend) => (
              <TrendCard key={trend.rank} trend={trend} />
            ))}
          </div>
          <RankingList />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <WhyTrending />
        <TodayBriefing />
      </div>

      <NewsletterCta />
    </div>
  );
}
