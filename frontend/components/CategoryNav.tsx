import Link from "next/link";
import Image from "next/image";

const FEATURED_CATEGORIES = [
  {
    label: "디저트 메뉴",
    desc: "지금 뜨는 디저트 트렌드",
    icon: "/images/strawberrycupcake.png",
    href: "/category?type=dessert",
  },
  {
    label: "음료",
    desc: "핫한 음료 & 레시피 트렌드",
    icon: "/images/coffee.png",
    href: "/category?type=drink",
  },
  {
    label: "마케팅·SNS",
    desc: "SNS 마케팅 & 콘텐츠 아이디어",
    icon: "/images/star.png",
    href: "/category?type=marketing",
  },
];

export default function CategoryNav() {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-xl text-dark">카테고리</h2>
        <Link
          href="/category"
          className="text-sm text-gray-400 transition-colors hover:text-strawberry"
        >
          전체 보기 →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURED_CATEGORIES.map((category) => (
          <Link
            key={category.label}
            href={category.href}
            className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-50">
              <Image
                src={category.icon}
                alt=""
                fill
                className="object-contain p-2"
              />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-dark">{category.label}</p>
              <p className="text-xs text-gray-400">{category.desc}</p>
            </div>
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-strawberry text-sm text-white"
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
