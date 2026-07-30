import Link from "next/link";
import { CATEGORIES } from "@/components/CategoryNav";

const STEPS = [
  {
    emoji: "📊",
    title: "데이터 수집",
    desc: "네이버 검색량, 블로그·카페 글, 유튜브 영상을 매일 자동으로 모아요.",
  },
  {
    emoji: "🧮",
    title: "트렌드 분석",
    desc: "검색량 변화와 언급 증가율을 계산해 지금 뜨는 메뉴를 찾아내요.",
  },
  {
    emoji: "☕",
    title: "브리핑 제공",
    desc: "왜 뜨는지, 얼마나 빨리 확산되는지를 사장님이 보기 쉽게 정리해요.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-12">
      <div className="text-center">
        <h1 className="font-heading text-3xl text-dark">
          TrendPick은 이런 서비스예요
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          카페·베이커리 사장님이 매일 아침, 지금 뜨는 메뉴를
          <br />
          한눈에 확인할 수 있도록 도와드려요.
        </p>
      </div>

      <section className="flex flex-col gap-5">
        <h2 className="font-heading text-2xl text-dark">어떻게 동작하나요?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-[24px] border border-[#f1dfd3] bg-white p-6 text-center"
            >
              <span className="text-3xl">{step.emoji}</span>
              <h3 className="mt-3 font-heading text-lg text-dark">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-heading text-2xl text-dark">어떤 트렌드를 다루나요?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((category) => (
            <div
              key={category.slug}
              className="rounded-[24px] border border-[#f1dfd3] bg-white p-6"
            >
              <p className="text-lg font-bold text-dark">{category.label}</p>
              <p className="mt-1 text-sm text-gray-500">{category.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-heading text-2xl text-dark">주요 기능</h2>
        <ul className="flex flex-col gap-3 text-base text-gray-600">
          <li className="flex items-start gap-2">
            <span aria-hidden>✅</span>
            즐겨찾기로 관심 있는 트렌드를 마이페이지에 모아둘 수 있어요
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden>✅</span>
            관심 카테고리를 설정하면 홈 화면에 먼저 반영돼요
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden>✅</span>
            매일 아침, 오늘의 트렌드 브리핑 알림을 받을 수 있어요
          </li>
        </ul>
      </section>

      <div className="flex justify-center">
        <Link
          href="/category"
          className="rounded-full bg-strawberry px-8 py-4 font-button text-lg font-semibold text-white transition-colors hover:opacity-90"
        >
          지금 트렌드 보러 가기 →
        </Link>
      </div>
    </div>
  );
}
