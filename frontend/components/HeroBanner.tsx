import Image from "next/image";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { TrendItem } from "@/lib/trends";

export default function HeroBanner({ trend }: { trend?: TrendItem }) {
  return (
    <section className="relative">
      <div className="grid gap-7 md:grid-cols-[.88fr_1.32fr]">
        <div className="flex flex-col justify-center gap-5 pb-12 md:pl-3">
          <h1 className="font-hero text-4xl leading-[1.35] text-dark md:text-5xl">
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
            <Link
              href="/category"
              className="flex items-center gap-2 rounded-full bg-strawberry px-6 py-3 font-button text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              이번 주 브리핑 보기 <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[38px] bg-gradient-to-br from-strawberry to-coral text-white shadow-md md:min-h-[440px]">
          <div className="absolute inset-0">
            <Image
              src={trend?.bannerImage || trend?.image || "/generated/hero-brioche-v2.png"}
              alt={trend?.title ?? ""}
              fill
              sizes="(max-width: 768px) 100vw, 60vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#8a3d1f]/90 via-[#c9704f]/45 to-transparent" />
          </div>

          <div className="relative flex flex-col gap-3 p-7 sm:pl-10 md:p-11 md:pl-10">
            <div className="flex items-start justify-between">
              <StatusBadge status={trend?.status ?? "상승기"} onDark />
              <span className="rotate-6 rounded-[45%] bg-[#fff9eb] px-3 py-3 text-center text-xs font-extrabold leading-tight text-strawberry shadow-sm">
                HOT<br />TREND!
              </span>
            </div>

            <h2 className="mt-6 font-heading text-4xl leading-tight md:text-5xl">
              {trend?.title ?? "딸기 크림 브리오슈"}
            </h2>
            <div className="flex gap-5 text-base">
              <span>
                검색량{" "}
                <b className="font-number text-lg">
                  {(trend?.searchGrowth ?? 0) >= 0 ? "+" : ""}
                  {trend?.searchGrowth ?? 78}%
                </b>
              </span>
            </div>
            {trend ? (
              <Link
                href={`/trend/${trend.id}`}
                className="mt-2 w-fit rounded-full bg-white px-5 py-2.5 font-button text-sm font-semibold text-strawberry"
              >
                자세히 보기 →
              </Link>
            ) : (
              <button className="mt-2 w-fit rounded-full bg-white px-5 py-2.5 font-button text-sm font-semibold text-strawberry">
                자세히 보기 →
              </button>
            )}
          </div>

        </div>
      </div>

      <div className="absolute -bottom-3 right-[18%] hidden items-center gap-3 text-[#dec1b1] md:flex"><span>←</span><span className="h-3 w-3 rounded-full bg-strawberry" /><span className="h-3 w-3 rounded-full border border-[#d9b6a4]" /><span className="h-3 w-3 rounded-full border border-[#d9b6a4]" /><span>→</span></div>

      <div className="pointer-events-none absolute -bottom-3 left-0 hidden h-20 w-24 md:block">
        <Image src="/generated/icon-strawberry.png" alt="" fill className="object-contain" />
      </div>
    </section>
  );
}
