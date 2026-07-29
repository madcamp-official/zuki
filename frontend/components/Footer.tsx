import Image from "next/image";
import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "서비스",
    links: [
      { label: "트렌드 브리핑", href: "/" },
      { label: "카테고리", href: "/category" },
      { label: "랭킹", href: "/ranking" },
      { label: "마이페이지", href: "/mypage" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative mt-8 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-[1.4fr_1fr_1fr] lg:pr-64">
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
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-sm font-bold text-dark">{col.title}</h3>
            <ul className="flex flex-col gap-2 text-xs text-gray-500">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-strawberry">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <aside className="relative w-[210px] justify-self-start rounded-[18px] border border-[#f3d46d] bg-[#fff0b7] p-5 text-center text-sm text-[#754016] shadow-sm sm:justify-self-end lg:absolute lg:right-[max(2rem,calc((100vw-72rem)/2))] lg:top-1/2 lg:-translate-y-1/2">
          <p className="font-bold">오늘의 한 줄</p>
          <p className="mt-2 font-semibold leading-relaxed">작은 변화가<br />매출을 빛나게 해요!</p>
          <span className="absolute -bottom-5 -right-3 h-12 w-12">
            <Image src="/generated/strawberry-large-v2.png" alt="" fill className="object-contain" />
          </span>
        </aside>
      </div>

      <div className="border-t border-black/5 px-6 py-4 text-center text-[11px] text-gray-400">
        © 2026 TrendPick. All rights reserved.
      </div>
    </footer>
  );
}
