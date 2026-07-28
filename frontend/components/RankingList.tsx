import Link from "next/link";
import type { TrendItem } from "@/lib/trends";

export default function RankingList({ trends }: { trends: TrendItem[] }) {
  return (
    <div className="flex h-full flex-col rounded-[24px] border border-[#f1dfd3] bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(139,62,35,0.035)]">
      <h2 className="mb-1 font-heading text-2xl text-dark">
        트렌드 랭킹 TOP 10 <span aria-hidden>📌</span>
      </h2>
      {trends.length === 0 ? (
        <p className="mt-4 flex-1 text-center text-sm text-gray-400">
          아직 등록된 트렌드가 없어요
        </p>
      ) : (
      <ul className="mt-3 flex flex-col gap-2.5">
          {trends.map((item) => (
            <li key={item.id}>
              <Link
                href={`/trend/${item.id}`}
                className="flex items-center gap-3 text-[13px]"
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-number text-xs font-bold ${
                    item.rank <= 3
                      ? "bg-strawberry text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {item.rank}
                </span>
                <span className="flex-1 truncate text-gray-700">
                  {item.title}
                </span>
                <span
                  className={`flex shrink-0 items-center gap-0.5 font-number text-xs font-semibold ${
                    item.mentionGrowth < 0 ? "text-blue-500" : "text-strawberry"
                  }`}
                >
                  {item.searchGrowth >= 0 ? "+" : ""}
                  {item.searchGrowth}%{" "}
                  <span aria-hidden>{item.mentionGrowth < 0 ? "↓" : "↑"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
