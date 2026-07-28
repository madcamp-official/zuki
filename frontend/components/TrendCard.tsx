"use client";

import Image from "next/image";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { TrendItem } from "@/lib/trends";

export default function TrendCard({ trend }: { trend: TrendItem }) {
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
          onClick={(e) => e.preventDefault()}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90"
        >
          <Image
            src="/images/bookmark.png"
            alt=""
            width={16}
            height={16}
            className="object-contain"
          />
        </button>
        <div className="absolute bottom-2 left-2">
          <StatusBadge status={trend.status} />
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        <h3 className="truncate text-center text-sm font-bold text-dark">{trend.title}</h3>
        <div className="flex justify-between border-t border-[#f7ede7] pt-2.5 text-[11px] text-gray-400">
          <span>
            검색량{" "}
            <b className="mt-0.5 block font-number text-base text-strawberry">
              +{trend.searchGrowth}%
            </b>
          </span>
          <span>
            언급량{" "}
            <b className="mt-0.5 block font-number text-base text-strawberry">
              {trend.mentionGrowth >= 0 ? "+" : ""}
              {trend.mentionGrowth}%
            </b>
          </span>
        </div>
      </div>
    </Link>
  );
}
