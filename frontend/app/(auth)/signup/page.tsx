"use client";

import { useState } from "react";
import Link from "next/link";
import KakaoLoginButton from "@/components/KakaoLoginButton";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
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
          <h1 className="font-heading text-xl text-dark">회원가입</h1>
          <p className="text-sm text-gray-400">
            가입하고 매일 아침 트렌드 브리핑을 받아보세요
          </p>
        </div>

        <KakaoLoginButton />

        <div className="my-6 flex items-center gap-3 text-xs text-gray-300">
          <span className="h-px flex-1 bg-gray-100" />
          또는
          <span className="h-px flex-1 bg-gray-100" />
        </div>

        {done ? (
          <p className="rounded-xl bg-orange-50 px-4 py-3 text-center text-sm text-strawberry">
            가입 확인 메일을 보냈어요. 메일함을 확인해주세요!
          </p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSignup}>
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
              minLength={6}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full rounded-full bg-strawberry py-3 font-button text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "가입 중..." : "이메일로 회원가입"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-strawberry">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
