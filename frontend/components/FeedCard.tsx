"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import { CATEGORY_LABELS } from "@/lib/trends";
import type { TrendItem } from "@/lib/trends";
import { addBookmark, removeBookmark } from "@/lib/api";

/**
 * SNS 피드 포스트처럼 트렌드 하나를 크게 보여주는 카드.
 * TrendCard(격자용 미니 카드)와 달리 세로로 길게, 이유·수치를 함께 노출해
 * 홈 화면을 스크롤하며 훑어보는 경험을 만든다.
 */
export default function FeedCard({
  trend,
  initialBookmarked = false,
}: {
  trend: TrendItem;
  initialBookmarked?: boolean;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);

  const handleBookmarkClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (pending) return;

    setPending(true);
    const next = !bookmarked;
    try {
      if (next) {
        await addBookmark(trend.id);
      } else {
        await removeBookmark(trend.id);
      }
      setBookmarked(next);
    } catch {
      router.push("/login");
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-[28px] border border-[#f1dfd3] bg-white shadow-[0_10px_30px_rgba(139,62,35,0.05)]">
      <Link href={`/trend/${trend.id}`} className="group block">
        <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10]">
          <Image
            src={trend.image}
            alt={trend.title}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

          <span className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-[#d81825] font-number text-lg font-bold text-white shadow-sm">
            {trend.rank}
          </span>
          <span className="absolute right-4 top-4 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {CATEGORY_LABELS[trend.category]}
          </span>

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
            <StatusBadge status={trend.status} onDark />
            <span className="rounded-full bg-white px-3 py-1.5 font-number text-sm font-extrabold text-strawberry shadow-sm">
              검색량 {trend.searchGrowth >= 0 ? "+" : ""}
              {trend.searchGrowth}%
            </span>
          </div>
        </div>
      </Link>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/trend/${trend.id}`}>
            <h3 className="font-heading text-xl text-dark hover:text-strawberry">
              {trend.title}
            </h3>
          </Link>
          <button
            aria-label="즐겨찾기"
            onClick={handleBookmarkClick}
            disabled={pending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream disabled:opacity-60"
          >
            <Image
              src="/generated/icons/bookmark-icon.png"
              alt=""
              width={16}
              height={16}
              className={`object-contain transition-opacity ${bookmarked ? "opacity-100" : "opacity-40"}`}
            />
          </button>
        </div>

        {trend.why.length > 0 && (
          <p className="text-sm leading-relaxed text-gray-500">
            <span aria-hidden>✅</span> {trend.why[0]}
          </p>
        )}
      </div>
    </article>
  );
}
