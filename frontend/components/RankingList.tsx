const RANKING = [
  { rank: 1, title: "딸기 크림 브리오슈", growth: 78 },
  { rank: 2, title: "말차 생크림 롤케이크", growth: 65 },
  { rank: 3, title: "소금버터 프레즐", growth: 52 },
  { rank: 4, title: "바닐라 크림 라떼", growth: 41 },
  { rank: 5, title: "리본 케이크", growth: 39 },
  { rank: 6, title: "초당옥수수 크림라떼", growth: 34 },
  { rank: 7, title: "흑임자 크림라떼", growth: 32 },
  { rank: 8, title: "요거트 아이스크림", growth: 29 },
  { rank: 9, title: "레터링 케이크", growth: 27 },
  { rank: 10, title: "딸기 바스크 치즈케이크", growth: 24 },
];

export default function RankingList() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-heading text-xl text-dark">
        트렌드 랭킹 TOP 10 <span aria-hidden>📌</span>
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {RANKING.map((item) => (
          <li key={item.rank} className="flex items-center gap-3 text-sm">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-number text-xs font-bold ${
                item.rank <= 3
                  ? "bg-strawberry text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {item.rank}
            </span>
            <span className="flex-1 truncate text-gray-700">{item.title}</span>
            <span className="flex shrink-0 items-center gap-0.5 font-number text-xs font-semibold text-strawberry">
              +{item.growth}% <span aria-hidden>↑</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
