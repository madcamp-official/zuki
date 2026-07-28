import Image from "next/image";

export default function NewsletterCta() {
  return (
    <section className="relative flex flex-col items-center gap-3 overflow-visible rounded-[24px] bg-gradient-to-r from-[#d80e19] via-strawberry to-[#ef5a4d] px-6 py-6 text-center text-white sm:flex-row sm:pr-48 sm:text-left">
      <div className="shrink-0"><h2 className="font-heading text-2xl">트렌드 알림을 받아보세요! 📩</h2>
      <p className="text-sm text-white/90">매일 아침, 최신 트렌드를 카톡으로 보내드려요.</p></div>
      <form className="flex w-full flex-col gap-2 sm:ml-auto sm:max-w-lg sm:flex-row">
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
      <div className="pointer-events-none absolute -bottom-10 right-4 z-10 hidden h-40 w-28 lg:block">
        <Image src="/generated/coffee-mascot-v1.png" alt="" fill className="object-contain object-bottom" />
      </div>
    </section>
  );
}
