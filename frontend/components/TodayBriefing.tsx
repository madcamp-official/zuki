import Image from "next/image";

const BRIEFINGS = [
  { no: "01", label: "딸기 브리핑", icon: "/images/cutestrawberry.png" },
  { no: "02", label: "말차 롤케이크", icon: "/images/chococupcake.png" },
  { no: "03", label: "소금프레즐", icon: "/images/cake.png" },
  { no: "04", label: "크림 라떼", icon: "/images/coffee.png" },
  { no: "05", label: "리본 케이크", icon: "/images/strawberrycupcake.png" },
];

export default function TodayBriefing() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-heading text-xl text-dark">오늘의 트렌드 브리핑</h2>
        <span className="rounded-full bg-strawberry/10 px-2.5 py-1 text-[11px] font-semibold text-strawberry">
          오늘 읽는데 3분
        </span>
      </div>

      <ul className="mt-3 flex flex-1 flex-col gap-1">
        {BRIEFINGS.map((item) => (
          <li
            key={item.no}
            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-cream"
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-50">
              <Image
                src={item.icon}
                alt=""
                fill
                className="object-contain p-1.5"
              />
            </span>
            <span className="text-sm font-medium text-gray-700">
              <span className="text-gray-400">{item.no} · </span>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <button className="mt-4 w-full rounded-full bg-strawberry py-2.5 font-button text-sm font-semibold text-white">
        전체 브리핑 보기 →
      </button>
    </div>
  );
}
