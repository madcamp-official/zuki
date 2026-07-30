"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/components/CategoryNav";
import StatusBadge from "@/components/StatusBadge";
import { fetchTrends } from "@/lib/api";
import type { TrendItem } from "@/lib/trends";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CATEGORY_ID_BY_SLUG: Record<string, number> = {
  dessert: 1,
  drink: 2,
  marketing: 3,
};

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].slug);
  const [regionScope, setRegionScope] = useState("nationwide");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  const canSubmit = title.trim().length > 0 && !submitting;

  const loadTrends = () => {
    setLoading(true);
    fetchTrends({ limit: 40 })
      .then(setTrends)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTrends();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const createRes = await fetch(`${API_URL}/api/admin/trends`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary: summary || undefined,
          reason: reason || undefined,
          categoryId: CATEGORY_ID_BY_SLUG[category],
          regionScope,
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error ?? "등록에 실패했어요");
      }

      const { trend } = await createRes.json();

      const publishRes = await fetch(
        `${API_URL}/api/admin/trends/${trend.id}/publish`,
        { method: "PATCH" },
      );

      if (!publishRes.ok) {
        throw new Error("등록은 됐지만 발행에 실패했어요");
      }

      setMessage(`"${title}" 트렌드를 등록하고 발행했어요`);
      setTitle("");
      setSummary("");
      setReason("");
      loadTrends();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="font-heading text-3xl text-dark">관리자 · 트렌드 큐레이션</h1>
        <p className="mt-2 text-sm text-gray-500">
          에디터가 직접 발굴한 트렌드를 등록하면{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            source: &apos;editor&apos;
          </code>
          로 저장되어 스코어링에 반영돼요. 이미지를 직접 넣지 않으면 AI가 자동으로
          생성해요 (10~20초 정도 걸려요).
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl text-dark">트렌드 수동 등록</h2>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="title" className="text-sm font-bold text-dark">
              트렌드명
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 두바이 초콜릿 라떼"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="category" className="text-sm font-bold text-dark">
              카테고리
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="regionScope" className="text-sm font-bold text-dark">
              확산 지역
            </label>
            <input
              id="regionScope"
              type="text"
              value={regionScope}
              onChange={(e) => setRegionScope(e.target.value)}
              placeholder="예) 대전·충청권 중심 확산"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="summary" className="text-sm font-bold text-dark">
              한 줄 요약
            </label>
            <input
              id="summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="예) 딸기와 크림이 듬뿍 올라간 브리오슈"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="reason" className="text-sm font-bold text-dark">
              왜 뜨는지 배경 설명 (줄바꿈으로 여러 개 입력)
            </label>
            <textarea
              id="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={"인스타그램 릴스 게시물 3배 증가\n유튜브 쇼츠 언급량 급상승"}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-full bg-strawberry py-3 font-button text-sm font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 sm:col-span-2"
          >
            {submitting ? "AI 이미지 생성 중... (최대 20초)" : "트렌드 등록하고 발행하기"}
          </button>

          {message && (
            <p className="text-sm text-gray-500 sm:col-span-2">{message}</p>
          )}
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl text-dark">등록된 트렌드 원시 데이터</h2>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">
              불러오는 중이에요...
            </p>
          ) : trends.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              아직 등록된 트렌드가 없어요
            </p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="py-2 pr-4 font-medium">ID</th>
                  <th className="py-2 pr-4 font-medium">트렌드명</th>
                  <th className="py-2 pr-4 font-medium">카테고리</th>
                  <th className="py-2 pr-4 font-medium">상태</th>
                  <th className="py-2 pr-4 font-medium">검색량 증감</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((trend) => (
                  <tr key={trend.id} className="border-b border-gray-50">
                    <td className="py-3 pr-4 font-number text-xs text-gray-400">
                      {trend.id}
                    </td>
                    <td className="py-3 pr-4 font-medium text-dark">
                      {trend.title}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{trend.category}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={trend.status} />
                    </td>
                    <td className="py-3 pr-4 font-number text-strawberry">
                      {trend.searchGrowth >= 0 ? "+" : ""}
                      {trend.searchGrowth}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
