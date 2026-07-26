import Image from "next/image";

export type TrendStatus = "태동기" | "상승기" | "전성기" | "하락기";

const STATUS_ICON: Record<TrendStatus, string | null> = {
  태동기: null,
  상승기: "/images/up.png",
  전성기: "/images/best.png",
  하락기: "/images/low.png",
};

export default function StatusBadge({ status }: { status: TrendStatus }) {
  const icon = STATUS_ICON[status];

  if (icon) {
    return (
      <span className="relative inline-block h-8 w-28 -my-1">
        <Image
          src={icon}
          alt={status}
          fill
          className="object-contain object-left"
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-500">
      <span aria-hidden>🌱</span>
      {status}
    </span>
  );
}
