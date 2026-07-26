"use client";

import { useState } from "react";
import Link from "next/link";

const REGIONS = [
  "서울",
  "경기·인천",
  "강원",
  "충청",
  "전라",
  "경상",
  "제주",
];

const CATEGORY_INTERESTS = [
  { label: "디저트 메뉴", icon: "🍰" },
  { label: "음료", icon: "🥤" },
  { label: "인테리어·소품", icon: "🪑" },
  { label: "마케팅·SNS", icon: "📱" },
  { label: "굿즈·패키지", icon: "🛍️" },
  { label: "이벤트·운영", icon: "🎉" },
];

export default function OnboardingPage() {
  const [storeName, setStoreName] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  const toggleInterest = (label: string) => {
    setInterests((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <div className="text-center">
        <span className="text-3xl" aria-hidden>
          🍓
        </span>
        <h1 className="mt-3 font-heading text-3xl text-dark">
          매장 정보를 알려주세요
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          입력하신 정보로 우리 매장에 맞는 트렌드만 골라드려요
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <label htmlFor="storeName" className="text-sm font-bold text-dark">
          매장명
        </label>
        <input
          id="storeName"
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="예) 소희네 카페"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-dark">매장 지역(상권)</p>
        <p className="-mt-2 text-xs text-gray-400">
          지역별 트렌드 확산 속도가 달라 맞춤 정보 제공에 활용돼요
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {REGIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRegion(item)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                region === item
                  ? "bg-strawberry text-white"
                  : "bg-cream text-gray-500 hover:bg-rose-50"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-dark">관심 카테고리</p>
        <p className="-mt-2 text-xs text-gray-400">
          여러 개 선택할 수 있어요
        </p>
        <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
          {CATEGORY_INTERESTS.map((category) => {
            const active = interests.includes(category.label);
            return (
              <button
                key={category.label}
                type="button"
                onClick={() => toggleInterest(category.label)}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-colors ${
                  active
                    ? "border-strawberry bg-rose-50"
                    : "border-transparent bg-cream hover:border-rose-100"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {category.icon}
                </span>
                <span className="whitespace-nowrap text-xs font-medium text-gray-600">
                  {category.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={!storeName || !region || interests.length === 0}
          className="w-full rounded-full bg-strawberry py-3.5 font-button text-sm font-bold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          시작하기
        </button>
        <Link
          href="/"
          className="text-center text-xs text-gray-400 hover:text-gray-500"
        >
          나중에 설정할게요
        </Link>
      </div>
    </div>
  );
}
