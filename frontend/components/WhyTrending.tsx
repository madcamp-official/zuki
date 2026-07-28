import Image from "next/image";
import type { TrendItem } from "@/lib/trends";

export default function WhyTrending({ trend }: { trend?: TrendItem }) {
  if (!trend) {
    return null;
  }

  return (
    <section className="grid gap-4 overflow-hidden rounded-[24px] border border-[#f4e3d7] bg-white/65 p-4 sm:grid-cols-[1fr_1.3fr]">
      <div className="relative min-h-[240px] overflow-hidden rounded-[18px]">
        <Image
          src={trend.image}
          alt={trend.title}
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
          왜 {trend.title}가 뜨고 있을까요?
        </h2>
        {trend.why.length === 0 ? (
          <p className="text-sm text-gray-400">아직 등록된 배경 설명이 없어요</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm text-gray-600">
            {trend.why.map((reason) => (
              <li key={reason} className="flex items-center gap-2">
                <span className="text-strawberry" aria-hidden>
                  ✅
                </span>
                {reason}
              </li>
            ))}
          </ul>
        )}
        <a
          href={`/trend/${trend.id}`}
          className="mt-2 w-fit rounded-full bg-strawberry px-5 py-2.5 font-button text-xs font-semibold text-white"
        >
          분석 리포트 보기 →
        </a>
      </div>
    </section>
  );
}
