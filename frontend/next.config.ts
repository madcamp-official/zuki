import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // next/image는 외부 호스트를 여기 등록해야 불러올 수 있다.
    remotePatterns: [
      {
        // 트렌드 카드 이미지 (백엔드가 OpenAI로 생성해 Supabase Storage에 업로드)
        protocol: "https",
        hostname: "bnghhjikybnoztaxjuey.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // 이미지가 아직 없는 카드의 대체 이미지
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
