const FOOTER_COLUMNS = [
  {
    title: "서비스",
    links: ["트렌드 브리핑", "카테고리", "랭킹", "즐겨찾기"],
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
    <footer className="mt-12 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
        <div>
          <span className="flex items-center gap-1 font-heading text-xl text-strawberry">
            🍓 TrendPick
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

        <div className="rounded-2xl bg-cream p-4 text-xs text-gray-500">
          <p className="font-bold text-dark">오늘의 한 줄</p>
          <p className="mt-2 leading-relaxed">
            작은 변화가 메뉴를 빛나게 해요!
          </p>
        </div>
      </div>

      <div className="border-t border-black/5 px-6 py-4 text-center text-[11px] text-gray-400">
        © 2026 TrendPick. All rights reserved.
      </div>
    </footer>
  );
}
