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
  updateMyProfile,
  type MyProfile,
} from "@/lib/api";

export default function MyPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [interests, setInterests] = useState<CategorySlug[]>([]);
  const [storeName, setStoreName] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(true);

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
          setStoreName(data.storeName ?? "");
          setNotifEnabled(data.notifEnabled);
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
          storeName: storeName.trim() || undefined,
          notifEnabled,
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
          즐겨찾기, 관심 카테고리, 매장 정보를 관리하려면 로그인이 필요해요
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
    <div className="mx-auto flex max-w-5xl flex-col gap-7 px-6 py-9">
      <div>
        <h1 className="font-heading text-4xl text-dark">내 매장 대시보드</h1>
        <p className="mt-2 text-lg text-gray-500">
          {storeName ? `${storeName} 사장님, 오늘도 매장 트렌드를 확인해 보세요.` : "매장에 딱 맞는 트렌드를 한눈에 관리하세요."}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] bg-gradient-to-br from-[#ff4d6d] to-[#e72c42] p-5 text-white shadow-sm"><p className="text-sm font-semibold text-white/80">오늘의 관심 트렌드</p><p className="mt-2 text-3xl font-extrabold">{bookmarked.length}개</p><p className="mt-2 text-sm text-white/90">저장한 메뉴를 바로 확인하세요</p></div>
        <div className="rounded-[24px] border border-[#f1dfd3] bg-white p-5"><p className="text-sm font-semibold text-gray-400">알림 브리핑</p><p className="mt-2 text-2xl font-extrabold text-dark">{notifEnabled ? "켜짐" : "꺼짐"}</p><p className="mt-2 text-sm text-gray-500">매일 아침 새 트렌드를 받아요</p></div>
        <div className="rounded-[24px] border border-[#f1dfd3] bg-white p-5"><p className="text-sm font-semibold text-gray-400">관심 분야</p><p className="mt-2 text-2xl font-extrabold text-dark">{interests.length}개</p><p className="mt-2 text-sm text-gray-500">맞춤형 트렌드를 우선 추천해요</p></div>
      </section>

      <section className="rounded-[24px] border border-[#f1dfd3] bg-white p-5">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-heading text-2xl text-dark">사장님 빠른 메뉴</h2><p className="mt-1 text-sm text-gray-400">자주 쓰는 기능을 바로 실행하세요</p></div><span className="text-2xl">✨</span></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/ranking" className="rounded-2xl bg-[#fff3f4] p-4 transition-transform hover:-translate-y-0.5"><span className="text-2xl">🔥</span><p className="mt-2 font-bold text-dark">오늘의 급상승 메뉴</p><p className="mt-1 text-sm text-gray-500">지금 뜨는 메뉴 확인</p></Link>
          <Link href="/category" className="rounded-2xl bg-[#fff8e9] p-4 transition-transform hover:-translate-y-0.5"><span className="text-2xl">🧁</span><p className="mt-2 font-bold text-dark">메뉴 아이디어 찾기</p><p className="mt-1 text-sm text-gray-500">카테고리별 트렌드 탐색</p></Link>
          <button type="button" onClick={() => setNotifEnabled((prev) => !prev)} className="rounded-2xl bg-[#f4f0ff] p-4 text-left transition-transform hover:-translate-y-0.5"><span className="text-2xl">🔔</span><p className="mt-2 font-bold text-dark">브리핑 알림 {notifEnabled ? "끄기" : "켜기"}</p><p className="mt-1 text-sm text-gray-500">매일 아침 맞춤 알림</p></button>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#f1dfd3] bg-white p-6 shadow-sm">
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
        <h2 className="font-heading text-2xl text-dark">매장 정보</h2>
        <p className="-mt-1 text-sm text-gray-400">
          매장명을 등록하면 브리핑 메시지에 반영돼요
        </p>
        <input
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="예: 소보로베이커리 강남점"
          maxLength={100}
          className="rounded-xl border border-[#f0e2d6] bg-cream px-4 py-3 text-base text-dark outline-none focus:border-strawberry"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl text-dark">알림 설정</h2>
            <p className="mt-1 text-sm text-gray-400">
              매일 아침, 오늘의 트렌드 브리핑을 알려드려요
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifEnabled}
            onClick={() => setNotifEnabled((prev) => !prev)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              notifEnabled ? "bg-strawberry" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                notifEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
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
