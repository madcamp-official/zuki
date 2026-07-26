import Image from "next/image";
import StatusBadge from "./StatusBadge";

export default function HeroBanner() {
  return (
    <section className="relative">
      <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col justify-center gap-4 pb-10">
          <h1 className="font-heading text-4xl leading-snug text-dark md:text-5xl">
            카페 트렌드,
            <br />
            <span className="text-strawberry">한눈에</span> 확인하세요!
          </h1>
          <p className="text-sm leading-relaxed text-gray-500 md:text-base">
            매일 수집·분석한 데이터를 바탕으로
            <br />
            지금 뜨는 메뉴와 컨셉을 미리 알려드려요.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button className="flex items-center gap-2 rounded-full bg-strawberry px-6 py-3 font-button text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5">
              이번 주 브리핑 보기 <span aria-hidden>→</span>
            </button>
            <button className="rounded-full border border-strawberry/30 bg-white px-6 py-3 font-button text-sm font-semibold text-strawberry transition-transform hover:-translate-y-0.5">
              서비스 둘러보기
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-strawberry to-coral text-white shadow-lg">
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1587314168485-3236d6710814?w=900&q=80"
              alt="딸기 크림 브리오슈"
              fill
              sizes="(max-width: 768px) 100vw, 60vw"
              className="object-cover opacity-90"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-strawberry/90 via-strawberry/40 to-transparent" />
          </div>

          <div className="relative flex flex-col gap-3 p-6 sm:pl-14 md:p-8 md:pl-16">
            <div className="flex items-center justify-between">
              <StatusBadge status="상승기" />
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                <span aria-hidden>💬</span> HOT TREND!
              </span>
            </div>

            <h2 className="mt-6 font-heading text-2xl md:text-3xl">
              딸기 크림
              <br />
              브리오슈
            </h2>
            <div className="flex gap-4 text-xs">
              <span>
                검색량 <b className="font-number text-sm">+78%</b>
              </span>
              <span>
                언급량(인스타) <b className="font-number text-sm">+63%</b>
              </span>
            </div>
            <button className="mt-2 w-fit rounded-full bg-white px-4 py-2 font-button text-xs font-semibold text-strawberry">
              자세히 보기 →
            </button>
          </div>

          <button
            aria-label="이전"
            className="absolute left-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-dark shadow sm:grid"
          >
            ←
          </button>
          <button
            aria-label="다음"
            className="absolute right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-dark shadow sm:grid"
          >
            →
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-2 left-0 hidden items-end gap-2 text-4xl md:flex">
        <span aria-hidden>🍓</span>
        <span aria-hidden className="text-lg">
          ✨
        </span>
      </div>
    </section>
  );
}
