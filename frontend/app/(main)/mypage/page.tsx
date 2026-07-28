"use client";

import { useState } from "react";
import TrendCard from "@/components/TrendCard";
import { CATEGORIES } from "@/components/CategoryNav";
import { TRENDS, type CategorySlug } from "@/lib/trends";
import { REGIONS, REGION_SI_LIST } from "@/lib/regions";

const BOOKMARKED_IDS = [
  "strawberry-cream-brioche",
  "matcha-cream-roll",
  "vanilla-cream-latte",
];

export default function MyPage() {
  const [interests, setInterests] = useState<CategorySlug[]>(["dessert"]);
  const [regionSi, setRegionSi] = useState<string | null>("대전");
  const [regionGu, setRegionGu] = useState<string | null>(null);

  const bookmarked = TRENDS.filter((trend) => BOOKMARKED_IDS.includes(trend.id));

  const toggleInterest = (slug: CategorySlug) => {
    setInterests((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="font-heading text-3xl text-dark">마이페이지</h1>
        <p className="mt-2 text-base text-gray-500">
          즐겨찾기와 관심 카테고리·지역을 관리하세요
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-2xl text-dark">즐겨찾기</h2>
        {bookmarked.length === 0 ? (
          <p className="mt-4 text-base text-gray-400">
            아직 즐겨찾기한 트렌드가 없어요
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {bookmarked.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-2xl text-dark">관심 카테고리</h2>
        <p className="-mt-1 text-sm text-gray-400">
          관심 카테고리를 등록하면 홈 브리핑에 우선 반영돼요
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {CATEGORIES.map((category) => {
            const active = interests.includes(category.slug as CategorySlug);
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => toggleInterest(category.slug as CategorySlug)}
                className={`rounded-full px-5 py-2.5 text-base font-semibold transition-colors ${
                  active
                    ? "bg-strawberry text-white"
                    : "bg-cream text-gray-500 hover:bg-rose-50"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-2xl text-dark">지역 설정</h2>
        <p className="-mt-1 text-sm text-gray-400">
          지역별로 트렌드 확산 속도가 달라 참고 정보로 활용돼요
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm font-semibold text-gray-400">시/도</p>
          <div className="flex flex-wrap gap-2">
            {REGION_SI_LIST.map((si) => (
              <button
                key={si}
                type="button"
                onClick={() => {
                  setRegionSi(si);
                  setRegionGu(null);
                }}
                className={`rounded-full px-4 py-2 text-base font-medium transition-colors ${
                  regionSi === si
                    ? "bg-strawberry text-white"
                    : "bg-cream text-gray-500 hover:bg-rose-50"
                }`}
              >
                {si}
              </button>
            ))}
          </div>
        </div>

        {regionSi && (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-sm font-semibold text-gray-400">구/군</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS[regionSi].map((gu) => (
                <button
                  key={gu}
                  type="button"
                  onClick={() => setRegionGu(gu)}
                  className={`rounded-full px-4 py-2 text-base font-medium transition-colors ${
                    regionGu === gu
                      ? "bg-strawberry text-white"
                      : "bg-cream text-gray-500 hover:bg-rose-50"
                  }`}
                >
                  {gu}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <button className="w-full rounded-full bg-strawberry py-3.5 font-button text-base font-bold text-white transition-colors hover:bg-rose-500">
        저장하기
      </button>
    </div>
  );
}
