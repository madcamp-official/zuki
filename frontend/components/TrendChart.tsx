"use client";

import { MONTH_LABELS } from "@/lib/trends";

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = 24;

export default function TrendChart({
  data,
  labels,
}: {
  data: number[];
  labels?: string[];
}) {
  if (data.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        아직 검색량 추이 데이터가 쌓이지 않았어요
      </p>
    );
  }

  const max = 100;
  const stepX = (WIDTH - PADDING * 2) / (data.length - 1);
  const axisLabels = labels ?? MONTH_LABELS.slice(-data.length);

  const points = data.map((value, i) => {
    const x = PADDING + i * stepX;
    const y = HEIGHT - PADDING - (value / max) * (HEIGHT - PADDING * 2);
    return { x, y, value };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${HEIGHT - PADDING} L ${points[0].x} ${HEIGHT - PADDING} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d6d" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ff4d6d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#ff4d6d"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#ff4d6d" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between font-number text-xs text-gray-400">
        {axisLabels.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
