"use client";

import Image from "next/image";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { TrendItem } from "@/lib/trends";

export default function TrendCard({ trend }: { trend: TrendItem }) {
  return (
    <Link
      href={`/trend/${trend.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        <Image
          src={trend.image}
          alt={trend.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-strawberry font-number text-xs font-bold text-white">
          {trend.rank}
        </span>
        <button
          aria-label="즐겨찾기"
          onClick={(e) => e.preventDefault()}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90"
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

      <div className="flex flex-col gap-1.5 p-3">
        <h3 className="text-sm font-bold text-dark">{trend.title}</h3>
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>
            검색량{" "}
            <b className="font-number text-strawberry">
              +{trend.searchGrowth}%
            </b>
          </span>
          <span>
            언급량{" "}
            <b className="font-number text-strawberry">
              {trend.mentionGrowth >= 0 ? "+" : ""}
              {trend.mentionGrowth}%
            </b>
          </span>
        </div>
      </div>
    </Link>
  );
}
