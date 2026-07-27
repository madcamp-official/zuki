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
    <div className="flex h-full flex-col rounded-[24px] border border-[#f4e3d7] bg-white/65 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-heading text-xl text-dark">오늘의 트렌드 브리핑</h2>
        <span className="text-[11px] font-semibold text-dark">오늘 읽는데 3분!</span>
      </div>

      <ul className="mt-4 grid flex-1 grid-cols-5 gap-1">
        {BRIEFINGS.map((item) => (
          <li
            key={item.no}
            className="flex flex-col items-center gap-1 rounded-xl p-1 text-center transition-colors hover:bg-cream"
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-50">
              <Image
                src={item.icon}
                alt=""
                fill
                className="object-contain p-1.5"
              />
            </span>
            <span className="text-[10px] font-medium leading-tight text-gray-700">
              <span className="block text-strawberry">{item.no}</span>
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
