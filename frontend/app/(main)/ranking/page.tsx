import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { CATEGORY_LABELS } from "@/lib/trends";
import { fetchTrends } from "@/lib/api";

export default async function RankingPage() {
  const trends = await fetchTrends({ limit: 10 });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="font-heading text-3xl text-dark">
          트렌드 랭킹 TOP 10 <span aria-hidden>📌</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          검색량·언급량 증감을 기준으로 매긴 이번 주 트렌드 순위예요
        </p>
      </div>

      {trends.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          아직 등록된 트렌드가 없어요
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trends.map((trend) => (
            <li key={trend.id}>
              <Link
                href={`/trend/${trend.id}`}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-number text-sm font-bold ${
                    trend.rank <= 3
                      ? "bg-strawberry text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {trend.rank}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-dark">
                      {trend.title}
                    </h2>
                    <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-strawberry">
                      {CATEGORY_LABELS[trend.category]}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs text-gray-400">
                    <span>
                      검색량{" "}
                      <b className="font-number text-strawberry">
                        +{trend.searchGrowth}%
                      </b>
                    </span>
                    <span>
                      언급량{" "}
                      <b className="font-number text-strawberry">
                        {trend.mentionGrowth >= 0 ? "+" : ""}
                        {trend.mentionGrowth}%
                      </b>
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <StatusBadge status={trend.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
