"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import TrendCard from "@/components/TrendCard";
import { CATEGORIES } from "@/components/CategoryNav";
import { TRENDS, type CategorySlug } from "@/lib/trends";

const ALL_TAB = "all";

export default function CategoryExplorer() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");
  const [active, setActive] = useState<CategorySlug | typeof ALL_TAB>(
    (initialType as CategorySlug) ?? ALL_TAB,
  );

  const filtered = useMemo(
    () =>
      active === ALL_TAB
        ? TRENDS
        : TRENDS.filter((trend) => trend.category === active),
    [active],
  );

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

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          아직 등록된 트렌드가 없어요
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}
    </>
  );
}
