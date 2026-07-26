export default function NewsletterCta() {
  return (
    <section className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-strawberry to-coral px-6 py-10 text-center text-white">
      <h2 className="font-heading text-2xl">트렌드 알림을 받아보세요! 📩</h2>
      <p className="text-sm text-white/90">
        매일 아침, 최신 트렌드를 카톡으로 보내드려요.
      </p>
      <form className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <input
          type="email"
          placeholder="이메일을 입력해주세요"
          className="w-full rounded-full px-5 py-3 text-sm text-dark outline-none placeholder:text-gray-400"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-yellow px-6 py-3 font-button text-sm font-bold text-dark"
        >
          구독하기
        </button>
      </form>
    </section>
  );
}
