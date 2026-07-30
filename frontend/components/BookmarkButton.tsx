"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addBookmark, removeBookmark } from "@/lib/api";

export default function BookmarkButton({
  trendId,
  initialBookmarked = false,
}: {
  trendId: string;
  initialBookmarked?: boolean;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    const next = !bookmarked;
    try {
      if (next) {
        await addBookmark(trendId);
      } else {
        await removeBookmark(trendId);
      }
      setBookmarked(next);
    } catch {
      router.push("/login");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex w-fit items-center gap-2 rounded-full bg-strawberry px-5 py-2.5 font-button text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
    >
      <Image
        src="/generated/icons/bookmark-icon.png"
        alt=""
        width={16}
        height={16}
        className="object-contain brightness-0 invert"
      />
      {bookmarked ? "즐겨찾기 완료" : "즐겨찾기에 담기"}
    </button>
  );
}
