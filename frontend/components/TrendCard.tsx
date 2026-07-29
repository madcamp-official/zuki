"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import type { TrendItem } from "@/lib/trends";
import { addBookmark, removeBookmark } from "@/lib/api";

export default function TrendCard({
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
      // 로그인 안 된 상태 등으로 실패하면 로그인 페이지로 안내
      router.push("/login");
    } finally {
      setPending(false);
    }
  };

  return (
    <Link
      href={`/trend/${trend.id}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-[#f2e3d9] bg-[#fffdfa] transition-transform hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative aspect-[.93] w-full overflow-hidden">
        <Image
          src={trend.image}
          alt={trend.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-[#d81825] font-number text-lg font-bold text-white shadow-sm">
          {trend.rank}
        </span>
        <button
          aria-label="즐겨찾기"
          onClick={handleBookmarkClick}
          disabled={pending}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 disabled:opacity-60"
        >
          <Image
            src="/generated/icons/bookmark-icon.png"
            alt=""
            width={16}
            height={16}
            className={`object-contain transition-opacity ${bookmarked ? "opacity-100" : "opacity-40"}`}
          />
        </button>
        <div className="absolute bottom-2 left-2">
          <StatusBadge status={trend.status} />
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        <h3 className="truncate text-center text-base font-bold text-dark">{trend.title}</h3>
        <div className="flex justify-between border-t border-[#f7ede7] pt-2.5 text-sm text-gray-400">
          <span>
            검색량{" "}
            <b className="mt-0.5 block font-number text-lg text-strawberry">
              {trend.searchGrowth >= 0 ? "+" : ""}
              {trend.searchGrowth}%
            </b>
          </span>
          <span>
            언급량{" "}
            <b className="mt-0.5 block font-number text-lg text-strawberry">
              {trend.mentionGrowth >= 0 ? "+" : ""}
              {trend.mentionGrowth}%
            </b>
          </span>
        </div>
      </div>
    </Link>
  );
}
