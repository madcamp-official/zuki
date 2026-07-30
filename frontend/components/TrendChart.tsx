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

  // Y축을 데이터에 맞춰 조정한다. 100으로 고정하면 검색지수가 낮은 키워드
  // (예: 8 언저리)가 바닥에 깔린 직선처럼 보여서, "+11% 증가" 같은 통계와
  // 그래프가 서로 안 맞는 것처럼 읽힌다. 실제 변동이 보이게 최대값의 1.3배를
  // 천장으로 쓰되, 너무 좁아져 노이즈가 산맥처럼 보이지 않게 하한 10을 둔다.
  const max = Math.max(10, Math.ceil(Math.max(...data) * 1.3));
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
