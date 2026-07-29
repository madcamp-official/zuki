"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "홈", href: "/" },
  { label: "트렌드 브리핑", href: "/category" },
  { label: "랭킹", href: "/ranking" },
  { label: "마이페이지", href: "/mypage" },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#f3e7df] bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-6">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="flex items-center gap-1 font-heading text-3xl text-strawberry">
            TrendPick
            <span className="relative h-7 w-7">
              <Image src="/generated/icon-strawberry.png" alt="" fill className="object-contain" />
            </span>
          </span>
          <span className="text-[11px] text-gray-400">
            사장님을 위한 트렌드 큐레이션
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-bold text-dark md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative py-4 transition-colors hover:text-strawberry ${
                  active
                    ? "text-strawberry after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-5 after:-translate-x-1/2 after:rounded-full after:bg-strawberry"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            aria-label="검색"
            className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5"
          >
            <Image
              src="/generated/icons/search-icon.png"
              alt=""
              fill
              className="object-contain p-2"
            />
          </button>
          <button
            aria-label="알림"
            className="relative grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5"
          >
            <Image
              src="/generated/icons/bell-icon.png"
              alt=""
              fill
              className="object-contain p-2"
            />
          </button>
          {loaded && user ? (
            <button
              onClick={handleLogout}
              className="rounded-full border border-strawberry/30 px-5 py-2 font-button text-sm font-semibold text-strawberry transition-colors hover:bg-rose-50"
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-strawberry px-5 py-2 font-button text-sm font-semibold text-white transition-colors hover:bg-rose-500"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
