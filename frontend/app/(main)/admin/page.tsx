"use client";

import { useState } from "react";
import { CATEGORIES } from "@/components/CategoryNav";
import StatusBadge, { TrendStatus } from "@/components/StatusBadge";
import { TRENDS } from "@/lib/trends";

const STATUS_OPTIONS: TrendStatus[] = ["태동기", "상승기", "전성기", "하락기"];

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].slug);
  const [status, setStatus] = useState<TrendStatus>("태동기");
  const [score, setScore] = useState("");

  const canSubmit = title.trim().length > 0 && score.trim().length > 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="font-heading text-3xl text-dark">관리자 · 트렌드 큐레이션</h1>
        <p className="mt-2 text-sm text-gray-500">
          에디터가 직접 발굴한 트렌드를 등록하면{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            source: &apos;editor&apos;
          </code>
          로 저장되어 스코어링에 반영돼요
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl text-dark">트렌드 수동 등록</h2>

        <form className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <label htmlFor="status" className="text-sm font-bold text-dark">
              확산 단계
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TrendStatus)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="score" className="text-sm font-bold text-dark">
              에디터 스코어 (0~100)
            </label>
            <input
              id="score"
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="데이터가 없는 신규 키워드는 에디터 가중치 100%로 반영돼요"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            />
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            className="w-full rounded-full bg-strawberry py-3 font-button text-sm font-bold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 sm:col-span-2"
          >
            트렌드 등록하기
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl text-dark">등록된 트렌드 원시 데이터</h2>
        <div className="mt-4 overflow-x-auto">
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
              {TRENDS.map((trend) => (
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
                    +{trend.searchGrowth}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
