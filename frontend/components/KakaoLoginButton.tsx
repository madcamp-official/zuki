"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function KakaoLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
    // 성공하면 카카오 인증 페이지로 리다이렉트되므로 별도 처리 불필요
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] px-5 py-3.5 font-button text-sm font-bold text-[#3C1E1E] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        <span aria-hidden>💬</span>
        {loading ? "카카오로 이동 중..." : "카카오로 3초 만에 시작하기"}
      </button>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
