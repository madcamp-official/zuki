import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "트렌드픽 | 사장님을 위한 트렌드 큐레이션",
  description: "매일 수집·분석한 데이터로 지금 뜨는 카페 메뉴와 컨셉을 미리 알려드려요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream">{children}</body>
    </html>
  );
}
