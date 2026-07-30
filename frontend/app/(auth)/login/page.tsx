"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import KakaoLoginButton from "@/components/KakaoLoginButton";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-50 via-cream to-cream px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Link href="/" className="font-heading text-2xl text-strawberry">
            🍓 TrendPick
          </Link>
          <p className="text-sm text-gray-400">
            사장님을 위한 트렌드 큐레이션
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="font-heading text-xl text-dark">
            로그인하고 시작하기
          </h1>
          <p className="text-sm text-gray-400">
            매일 아침, 뜨는 트렌드를 가장 먼저 받아보세요
          </p>
        </div>

        <KakaoLoginButton />

        <div className="my-6 flex items-center gap-3 text-xs text-gray-300">
          <span className="h-px flex-1 bg-gray-100" />
          또는
          <span className="h-px flex-1 bg-gray-100" />
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleEmailLogin}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-full bg-strawberry py-3 font-button text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "로그인 중..." : "이메일로 로그인"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-semibold text-strawberry">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
