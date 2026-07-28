import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-rose-50 via-cream to-cream px-6 py-12">
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

        <button className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] px-5 py-3.5 font-button text-sm font-bold text-[#3C1E1E] transition-transform hover:-translate-y-0.5">
          <span aria-hidden>💬</span>
          카카오로 3초 만에 시작하기
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-gray-300">
          <span className="h-px flex-1 bg-gray-100" />
          또는
          <span className="h-px flex-1 bg-gray-100" />
        </div>

        <form className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="이메일"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
          />
          <input
            type="password"
            placeholder="비밀번호"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
          />
          <input
            type="password"
            placeholder="비밀번호 확인"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-strawberry"
          />
          <button
            type="submit"
            className="mt-1 w-full rounded-full bg-strawberry py-3 font-button text-sm font-semibold text-white transition-colors hover:bg-rose-500"
          >
            이메일로 회원가입
          </button>
        </form>

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
