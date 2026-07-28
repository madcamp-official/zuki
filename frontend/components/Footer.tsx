const FOOTER_COLUMNS = [
  {
    title: "서비스",
    links: ["트렌드 브리핑", "카테고리", "랭킹", "마이페이지"],
  },
  {
    title: "고객센터",
    links: ["자주 묻는 질문", "문의하기", "의견 제안"],
  },
  {
    title: "회사",
    links: ["서비스 소개", "이용약관", "개인정보처리방침"],
  },
];

export default function Footer() {
  return (
    <footer className="relative mt-8 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr] lg:pr-64">
        <div>
          <span className="flex items-center gap-1 font-heading text-2xl text-strawberry">
            TrendPick
            <span className="relative h-6 w-6">
              <Image src="/generated/icon-strawberry.png" alt="" fill className="object-contain" />
            </span>
          </span>
          <p className="mt-2 text-xs text-gray-400">
            사장님을 위한 트렌드 큐레이션
          </p>
          <div className="mt-4 flex gap-3 text-lg text-gray-400">
            <span aria-hidden>📷</span>
            <span aria-hidden>💬</span>
            <span aria-hidden>▶️</span>
          </div>
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-sm font-bold text-dark">{col.title}</h3>
            <ul className="flex flex-col gap-2 text-xs text-gray-500">
              {col.links.map((link) => (
                <li key={link}>{link}</li>
              ))}
            </ul>
          </div>
        ))}

      </div>

      <aside className="mx-auto mb-6 w-[210px] rounded-[18px] border border-[#f3d46d] bg-[#fff0b7] p-5 text-center text-sm text-[#754016] shadow-sm lg:absolute lg:bottom-6 lg:right-[max(2rem,calc((100vw-72rem)/2))] lg:mb-0">
        <p className="font-bold">오늘의 한 줄</p>
        <p className="mt-2 font-semibold leading-relaxed">작은 변화가<br />매출을 빛나게 해요!</p>
        <span className="absolute -bottom-5 -right-3 h-12 w-12">
          <Image src="/generated/strawberry-large-v2.png" alt="" fill className="object-contain" />
        </span>
      </aside>

      <div className="border-t border-black/5 px-6 py-4 text-center text-[11px] text-gray-400">
        © 2026 TrendPick. All rights reserved.
      </div>
    </footer>
  );
}
import Image from "next/image";
