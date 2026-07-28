"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TrendCard from "@/components/TrendCard";
import { CATEGORIES } from "@/components/CategoryNav";
import type { CategorySlug, TrendItem } from "@/lib/trends";
import { fetchTrends } from "@/lib/api";

const ALL_TAB = "all";

export default function CategoryExplorer() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");
  const [active, setActive] = useState<CategorySlug | typeof ALL_TAB>(
    (initialType as CategorySlug) ?? ALL_TAB,
  );
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchTrends(active === ALL_TAB ? { limit: 40 } : { category: active, limit: 40 })
      .then((data) => {
        if (!cancelled) setTrends(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActive(ALL_TAB)}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
            active === ALL_TAB
              ? "bg-strawberry text-white"
              : "bg-white text-gray-500 hover:bg-rose-50"
          }`}
        >
          전체
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category.slug}
            onClick={() => setActive(category.slug as CategorySlug)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              active === category.slug
                ? "bg-strawberry text-white"
                : "bg-white text-gray-500 hover:bg-rose-50"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-400">
          불러오는 중이에요...
        </p>
      ) : trends.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          아직 등록된 트렌드가 없어요
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {trends.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}
    </>
  );
}
