export type TrendStatus = "태동기" | "상승기" | "전성기" | "하락기";

const STATUS_STYLE: Record<TrendStatus, string> = {
  태동기: "bg-blue-50 text-blue-500",
  상승기: "bg-rose-100 text-strawberry",
  전성기: "bg-yellow-100 text-amber-700",
  하락기: "bg-gray-100 text-gray-500",
};

const STATUS_STYLE_ON_DARK: Record<TrendStatus, string> = {
  태동기: "bg-white/25 text-white",
  상승기: "bg-white/25 text-white",
  전성기: "bg-white/25 text-white",
  하락기: "bg-white/25 text-white",
};

const STATUS_ICON: Record<TrendStatus, string> = {
  태동기: "🌱",
  상승기: "🔥",
  전성기: "👑",
  하락기: "📉",
};

export default function StatusBadge({
  status,
  onDark = false,
}: {
  status: TrendStatus;
  onDark?: boolean;
}) {
  const style = onDark ? STATUS_STYLE_ON_DARK[status] : STATUS_STYLE[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${style}`}
    >
      <span aria-hidden>{STATUS_ICON[status]}</span>
      {status}
    </span>
  );
}
