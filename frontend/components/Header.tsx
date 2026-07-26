import Link from "next/link";
import Image from "next/image";

const NAV_ITEMS = [
  { label: "홈", href: "/" },
  { label: "트렌드 브리핑", href: "/briefing" },
  { label: "카테고리", href: "/category" },
  { label: "랭킹", href: "/ranking" },
  { label: "즐겨찾기", href: "/bookmarks" },
  { label: "마이페이지", href: "/mypage" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="flex items-center gap-1 font-heading text-2xl text-strawberry">
            🍓 TrendPick
          </span>
          <span className="text-[11px] text-gray-400">
            사장님을 위한 트렌드 큐레이션
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-strawberry"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            aria-label="검색"
            className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5"
          >
            <Image src="/images/search.png" alt="" fill className="object-contain p-1.5" />
          </button>
          <button
            aria-label="알림"
            className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5"
          >
            <Image src="/images/bell.png" alt="" fill className="object-contain p-1.5" />
          </button>
          <Link
            href="/login"
            className="rounded-full bg-strawberry px-5 py-2 font-button text-sm font-semibold text-white transition-colors hover:bg-rose-500"
          >
            로그인
          </Link>
        </div>
      </div>
    </header>
  );
}
