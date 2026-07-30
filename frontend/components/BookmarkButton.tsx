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

  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const next = !bookmarked;
    try {
      if (next) {
        await addBookmark(trendId);
      } else {
        await removeBookmark(trendId);
      }
      setBookmarked(next);
    } catch (e) {
      /*
       * 예전엔 어떤 에러든 /login으로 보냈다. 그래서 네트워크 실패·CORS 차단·
       * 서버 500까지 전부 "로그인 안 됨"으로 둔갑해, 멀쩡히 로그인한 사용자가
       * 로그인 화면으로 튕겼다. 인증 문제일 때만 로그인으로 보내고,
       * 나머지는 이유를 그대로 보여준다.
       */
      const message = e instanceof Error ? e.message : String(e);
      const isAuthError =
        message.includes("로그인이 필요") ||
        message.includes("401") ||
        message.includes("토큰");

      if (isAuthError) {
        router.push("/login");
        return;
      }
      setError("잠시 후 다시 시도해주세요.");
      console.error("[BookmarkButton] 즐겨찾기 실패:", message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex w-fit flex-col gap-1.5">
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
      {error && <p className="text-xs text-gray-400">{error}</p>}
    </div>
  );
}
