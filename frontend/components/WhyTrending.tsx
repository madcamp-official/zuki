import Image from "next/image";

const REASONS = [
  "인스타그램 릴스 게시물 3배 증가",
  "유튜브 소중 언급량 급상승",
  "봄 시즌 딸기 수요 증가",
  "유명 카페 신메뉴 출시 잇따라",
];

export default function WhyTrending() {
  return (
    <section className="grid gap-4 overflow-hidden rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-[1fr_1.3fr]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
        <Image
          src="https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&q=80"
          alt="딸기 크림 브리오슈"
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col justify-center gap-3">
        <span className="w-fit rounded-full bg-yellow/40 px-3 py-1 text-xs font-semibold text-amber-700">
          WHY IT&apos;S TRENDING?
        </span>
        <h2 className="font-heading text-2xl text-dark">
          왜 이 메뉴가 뜨고 있을까요?
        </h2>
        <ul className="flex flex-col gap-1.5 text-sm text-gray-600">
          {REASONS.map((reason) => (
            <li key={reason} className="flex items-center gap-2">
              <span className="text-strawberry" aria-hidden>
                ✅
              </span>
              {reason}
            </li>
          ))}
        </ul>
        <button className="mt-2 w-fit rounded-full bg-strawberry px-5 py-2.5 font-button text-xs font-semibold text-white">
          분석 리포트 보기 →
        </button>
      </div>
    </section>
  );
}
