import Link from "next/link";
import Image from "next/image";

export const CATEGORIES = [
  {
    label: "디저트",
    desc: "디저트·빵류 트렌드",
    icon: "/generated/dessert-large-v2.png",
    slug: "dessert",
  },
  {
    label: "음료",
    desc: "핫한 음료 & 레시피 트렌드",
    icon: "/generated/drink-large-v2.png",
    slug: "drink",
  },
  {
    label: "마케팅",
    desc: "SNS 마케팅 & 콘텐츠 아이디어",
    icon: "/generated/social-large-v2.png",
    slug: "marketing",
  },
];

const FEATURED_CATEGORIES = CATEGORIES.map((category) => ({
  ...category,
  href: `/category?type=${category.slug}`,
}));

export default function CategoryNav() {
  return (
    <section className="rounded-[28px] border border-[#f4e3d7] bg-white/45 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-xl text-dark">카테고리</h2>
        <Link
          href="/category"
          className="text-sm text-gray-400 transition-colors hover:text-strawberry"
        >
          전체 보기  ›
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURED_CATEGORIES.map((category) => (
          <Link
            key={category.label}
            href={category.href}
            className="flex min-h-[144px] items-center gap-5 rounded-[24px] border border-[#f6e6da] bg-white/70 px-6 py-4 transition-transform hover:-translate-y-1 hover:shadow-md"
          >
            <span className="relative grid h-24 w-24 shrink-0 place-items-center">
              <Image
                src={category.icon}
                alt=""
                fill
                sizes="96px"
                className="object-contain"
              />
            </span>
            <div className="flex-1">
              <p className="text-xl font-bold text-dark">
                {category.label === "마케팅" ? "마케팅 · SNS" : `${category.label} 메뉴`}
              </p>
              <p className="mt-1 text-sm text-gray-400">{category.desc}</p>
            </div>
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-strawberry text-xl text-white"
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
