import Image from "next/image";
import Link from "next/link";
import type { TrendItem } from "@/lib/trends";

export default function TodayBriefing({ trends }: { trends: TrendItem[] }) {
  return (
    <div className="flex h-full flex-col rounded-[24px] border border-[#f1dfd3] bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(139,62,35,0.035)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-heading text-2xl text-dark">오늘의 트렌드 브리핑</h2>
        <span className="text-[11px] font-semibold text-dark">오늘 읽는데 3분!</span>
      </div>

      {trends.length === 0 ? (
        <p className="flex-1 py-6 text-center text-sm text-gray-400">
          아직 등록된 트렌드가 없어요
        </p>
      ) : (
        <ul className="mt-4 grid flex-1 grid-cols-5 gap-2">
          {trends.map((item, index) => (
            <li
              key={item.id}
              className="flex flex-col items-center gap-1 rounded-xl p-1 text-center transition-colors hover:bg-cream"
            >
              <Link href={`/trend/${item.id}`} className="flex flex-col items-center gap-1">
                <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-[#f5e6dc] bg-orange-50">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                </span>
                <span className="text-[10px] font-medium leading-tight text-gray-700">
                  <span className="block text-strawberry">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/ranking"
        className="mt-4 w-full rounded-full bg-strawberry py-2.5 text-center font-button text-sm font-semibold text-white"
      >
        전체 브리핑 보기 →
      </Link>
    </div>
  );
}
