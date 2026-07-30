"use client";

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 30, right: 22, bottom: 34, left: 22 };

export default function TrendChart({
  data,
  labels = [],
}: {
  data: number[];
  labels?: string[];
}) {
  if (data.length < 2) {
    return (
      <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[#f2ddd3] bg-[#fffaf7] text-center">
        <div><span className="text-2xl">📈</span><p className="mt-2 text-sm font-semibold text-gray-500">추이 데이터를 수집 중이에요</p></div>
      </div>
    );
  }

  const rawMin = Math.min(...data);
  const rawMax = Math.max(...data);
  // 0~100 전체 축 대신 실제 변동 폭을 확대해 작은 상승도 한눈에 읽히게 한다.
  const range = Math.max(rawMax - rawMin, 8);
  const min = Math.max(0, rawMin - range * 0.32);
  const max = Math.min(100, rawMax + range * 0.22);
  const domain = Math.max(max - min, 1);
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const stepX = chartWidth / (data.length - 1);
  const points = data.map((value, i) => ({
    x: PADDING.left + i * stepX,
    y: PADDING.top + chartHeight - ((value - min) / domain) * chartHeight,
    value,
  }));
  const linePath = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points.at(-1)!.x} ${PADDING.top + chartHeight} L ${points[0].x} ${PADDING.top + chartHeight} Z`;
  const recent = data.slice(-Math.min(7, data.length));
  const delta = Math.round((recent.at(-1)! - recent[0]) * 100) / 100;
  const peakIndex = data.lastIndexOf(rawMax);
  const labelIndices = Array.from(new Set([0, Math.round((data.length - 1) / 4), Math.round((data.length - 1) / 2), Math.round((data.length - 1) * 0.75), data.length - 1]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#fff0f2] px-3 py-1 text-xs font-bold text-strawberry">최근 {recent.length}일 {delta >= 0 ? "+" : ""}{delta}p</span>
        <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-xs font-bold text-amber-700">최고 {rawMax}점</span>
        <span className="text-xs text-gray-400">변동 폭 확대 보기</span>
      </div>
      <div className="rounded-2xl border border-[#f7e9e1] bg-gradient-to-b from-[#fffdfb] to-[#fff7f5] px-2 pt-2">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[240px] w-full" role="img" aria-label="검색량 추이 그래프">
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c9704f" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#c9704f" stopOpacity="0.02" />
            </linearGradient>
            <filter id="trendGlow" x="-20%" y="-30%" width="140%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#c9704f" floodOpacity=".28" /></filter>
          </defs>
          {[0.2, 0.5, 0.8].map((mark) => <line key={mark} x1={PADDING.left} x2={WIDTH - PADDING.right} y1={PADDING.top + chartHeight * mark} y2={PADDING.top + chartHeight * mark} stroke="#f6dfd8" strokeDasharray="4 6" />)}
          <path d={areaPath} fill="url(#trendFill)" />
          <path d={linePath} fill="none" stroke="#c9704f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#trendGlow)" />
          {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 6 : 3.5} fill="#fff" stroke="#c9704f" strokeWidth={i === points.length - 1 ? 4 : 2.5} />)}
          <g transform={`translate(${points[peakIndex].x - 25} ${Math.max(4, points[peakIndex].y - 28)})`}><rect width="50" height="20" rx="10" fill="#d81928" /><text x="25" y="14" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">PEAK</text></g>
          {labelIndices.map((i) => <text key={i} x={points[i].x} y={HEIGHT - 10} textAnchor="middle" fill="#a4a0a0" fontSize="11">{labels[i] ?? `${i + 1}일`}</text>)}
        </svg>
      </div>
    </div>
  );
}
