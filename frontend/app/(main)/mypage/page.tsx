"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TrendCard from "@/components/TrendCard";
import { CATEGORIES } from "@/components/CategoryNav";
import type { CategorySlug, TrendItem } from "@/lib/trends";
import {
  fetchMyBookmarks,
  fetchMyProfile,
  updateMyCategoryInterests,
  type MyProfile,
} from "@/lib/api";

export default function MyPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [interests, setInterests] = useState<CategorySlug[]>([]);

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
      await updateMyCategoryInterests(interests);
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
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-24 text-center">
        <h1 className="font-heading text-3xl text-dark">마이페이지</h1>
        <p className="text-lg text-gray-500">
          즐겨찾기와 관심 카테고리를 관리하려면
          <br />
          로그인이 필요해요
        </p>
        <Link
          href="/login"
          className="rounded-full bg-strawberry px-8 py-4 font-button text-lg font-semibold text-white transition-colors hover:opacity-90"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="font-heading text-3xl text-dark">마이페이지</h1>
        <p className="mt-2 text-lg text-gray-500">
          즐겨찾기와 관심 카테고리를 관리하세요
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl text-dark">즐겨찾기</h2>
        {loadingBookmarks ? (
          <p className="text-lg text-gray-400">불러오는 중이에요...</p>
        ) : bookmarked.length === 0 ? (
          <p className="text-lg text-gray-400">
            아직 즐겨찾기한 트렌드가 없어요
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {bookmarked.map((trend) => (
              <TrendCard key={trend.id} trend={trend} initialBookmarked />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-2xl text-dark">관심 카테고리</h2>
          <p className="mt-1 text-base text-gray-400">
            선택한 카테고리를 홈 화면에서 먼저 보여드려요
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((category) => {
            const active = interests.includes(category.slug as CategorySlug);
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => toggleInterest(category.slug as CategorySlug)}
                className={`rounded-full px-7 py-3.5 text-lg font-semibold transition-colors ${
                  active
                    ? "bg-strawberry text-white"
                    : "bg-cream text-gray-500 hover:bg-orange-50"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full bg-strawberry py-4 font-button text-lg font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
        {saveMessage && (
          <p className="text-center text-base text-gray-500">{saveMessage}</p>
        )}
      </div>
    </div>
  );
}
