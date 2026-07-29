"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TrendCard from "@/components/TrendCard";
import { CATEGORIES } from "@/components/CategoryNav";
import type { CategorySlug, TrendItem } from "@/lib/trends";
import { REGIONS, REGION_SI_LIST } from "@/lib/regions";
import {
  fetchMyBookmarks,
  fetchMyProfile,
  updateMyCategoryInterests,
  updateMyProfile,
  type MyProfile,
} from "@/lib/api";

export default function MyPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [interests, setInterests] = useState<CategorySlug[]>([]);
  const [regionSi, setRegionSi] = useState<string | null>(null);
  const [regionGu, setRegionGu] = useState<string | null>(null);

  const [bookmarked, setBookmarked] = useState<TrendItem[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchMyProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        if (data) {
          setInterests(data.categoryInterests.map((c) => c.slug));
          setRegionSi(data.regionSi);
          setRegionGu(data.regionGu);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingProfile) return;

    let cancelled = false;
    setLoadingBookmarks(true);

    const loadBookmarks = profile ? fetchMyBookmarks() : Promise.resolve([]);
    loadBookmarks
      .then((data) => {
        if (!cancelled) setBookmarked(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingBookmarks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadingProfile, profile]);

  const toggleInterest = (slug: CategorySlug) => {
    setInterests((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await Promise.all([
        updateMyProfile({
          regionSi: regionSi ?? undefined,
          regionGu: regionGu ?? undefined,
        }),
        updateMyCategoryInterests(interests),
      ]);
      setSaveMessage("저장했어요!");
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "저장에 실패했어요",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!loadingProfile && !profile) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-20 text-center">
        <h1 className="font-heading text-3xl text-dark">마이페이지</h1>
        <p className="text-base text-gray-500">
          즐겨찾기와 관심 카테고리·지역을 관리하려면 로그인이 필요해요
        </p>
        <Link
          href="/login"
          className="rounded-full bg-strawberry px-6 py-3 font-button text-base font-semibold text-white transition-colors hover:bg-rose-500"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

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
        {loadingBookmarks ? (
          <p className="mt-4 text-base text-gray-400">불러오는 중이에요...</p>
        ) : bookmarked.length === 0 ? (
          <p className="mt-4 text-base text-gray-400">
            아직 즐겨찾기한 트렌드가 없어요
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {bookmarked.map((trend) => (
              <TrendCard key={trend.id} trend={trend} initialBookmarked />
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

      <div className="flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full bg-strawberry py-3.5 font-button text-base font-bold text-white transition-colors hover:bg-rose-500 disabled:opacity-60"
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
        {saveMessage && (
          <p className="text-center text-sm text-gray-500">{saveMessage}</p>
        )}
      </div>
    </div>
  );
}
