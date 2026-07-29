import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

/**
 * 생성한 이미지는 Supabase Storage에 올린다.
 *
 * 예전에는 frontend/public/generated/trends/ 아래에 파일로 썼는데 배포 환경에서
 * 동작하지 않았다:
 *   - Render는 backend/만 배포하므로 frontend/ 폴더가 존재하지 않는다
 *   - 프론트(Vercel)는 다른 서버라 백엔드 디스크의 파일을 읽을 수 없다
 *   - Render 디스크는 재배포 시 초기화되어 이미지가 사라진다
 *
 * Storage에 올리면 공개 URL이 생겨 프론트가 어디에 있든 접근 가능하고,
 * 재배포와 무관하게 남는다.
 *
 * SUPABASE_SERVICE_ROLE_KEY가 없으면(로컬 개발 등) 기존처럼 파일로 저장한다.
 */
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'trend-images';

// 로컬 폴백 경로 (스크립트 scripts/generate-trend-images.ts와 동일 경로 공유)
const OUTPUT_DIR = path.resolve(__dirname, '../../../frontend/public/generated/trends');

const COMMON_STYLE =
  'Ultra realistic, premium bakery advertisement, commercial food photography, ' +
  'centered composition, isolated food, warm cream beige background, ' +
  'soft diffused studio lighting, shallow depth of field, vibrant but warm colors, ' +
  'glossy texture, highly detailed, food magazine quality, 8k, minimal props, ' +
  'food fills most of the frame, clean composition, no text, no watermark, no logo, ' +
  'no people, square crop, perfect for a website card.';

// 마케팅 트렌드는 "메뉴"가 아니라 활동/이벤트라 실제 소재를 직접 지정
const MARKETING_SUBJECT: Record<string, string> = {
  '인생네컷 콜라보 이벤트':
    'A vintage instant film camera on a cafe table next to a stack of blank white instant photo frames (completely blank, no images inside the frames)',
  '카페 브이로그 챌린지':
    'A smartphone on a mini tripod filming a coffee cup on a cafe table',
  '시즌 한정 굿즈 마케팅':
    'A neatly arranged set of seasonal cafe merchandise: a tumbler and a tote bag',
  '레터링 케이크':
    'An elegant lettering cake (a round cake with delicate icing decoration, no readable text)',
};

const MENU_PROMPT: Record<string, string> = {
  '딸기 크림 브리오슈':
    'Strawberry cream brioche toast stacked high with fresh strawberries, thick whipped cream overflowing, glossy strawberry syrup dripping down, powdered sugar',
  '말차 생크림 롤케이크':
    'Premium matcha swiss roll cake with thick whipped cream filling, vibrant green matcha sponge, sliced neatly',
  '소금버터 프레즐':
    'Freshly baked butter pretzel with flaky sea salt, golden brown crust, glossy buttery surface',
  '바닐라 크림 라떼':
    'Iced vanilla cream latte in a clear glass, thick whipped cream topping, caramel drizzle, condensation on glass',
  '리본 케이크':
    'Strawberry ribbon cake with soft whipped cream frosting, elegant ribbon decoration, pastel pink cream',
};

export function buildTrendImagePrompt(
  title: string,
  categorySlug: string,
  summary: string | null,
): string {
  if (categorySlug === 'marketing') {
    const subject = MARKETING_SUBJECT[title] ?? `A cafe marketing prop related to "${title}"`;
    return `${subject}. ${COMMON_STYLE}`;
  }

  const known = MENU_PROMPT[title];
  if (known) {
    return `${known}. ${COMMON_STYLE}`;
  }

  const detail = summary && summary !== title ? summary : title;
  const kind = categorySlug === 'beverage' ? 'cafe beverage' : 'cafe dessert';
  return `A ${kind} called "${title}" (${detail}), photographed as the main subject. ${COMMON_STYLE}`;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * Supabase Storage에 업로드하고 공개 URL을 반환한다.
 *
 * 업로드에는 service_role 키가 필요하다(버킷 쓰기 정책이 service_role 전용).
 * 이 키는 RLS를 우회하는 최고 권한이므로 절대 브라우저에 노출하면 안 된다.
 */
async function uploadToStorage(fileName: string, buffer: Buffer): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  }

  const objectPath = `${STORAGE_BUCKET}/${fileName}`;
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'image/png',
      // 같은 트렌드를 다시 생성하면 덮어쓴다
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    throw new Error(`Storage 업로드 실패: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${objectPath}`;
}

/**
 * 트렌드 하나에 대해 OpenAI로 이미지를 생성하고 접근 가능한 URL을 반환한다.
 *
 * 기본은 Supabase Storage 업로드(공개 URL). service_role 키가 없으면
 * 로컬 파일로 저장하고 상대 경로를 돌려준다 — 로컬 개발 편의를 위한 폴백이다.
 */
export async function generateTrendImage(
  trendId: string | number,
  title: string,
  categorySlug: string,
  summary: string | null,
): Promise<string> {
  const prompt = buildTrendImagePrompt(title, categorySlug, summary);

  /**
   * 모델·품질은 환경변수로 조정 가능. 장당 대략 비용(1024x1024, medium 기준):
   *   gpt-image-1       $0.042   (2026-10-23 지원 종료 예정)
   *   gpt-image-1.5     $0.034
   *   gpt-image-1-mini  $0.011
   * 카드 10개 생성 시 $0.11 ~ $0.42 수준이다.
   */
  const result = await getClient().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
    prompt,
    size: '1024x1024',
    quality: (process.env.OPENAI_IMAGE_QUALITY ?? 'medium') as 'low' | 'medium' | 'high',
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI 응답에 이미지 데이터가 없습니다.');
  }

  const buffer = Buffer.from(b64, 'base64');
  const fileName = `trend-${trendId}.png`;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return uploadToStorage(fileName, buffer);
  }

  // 로컬 폴백: 프론트 public 폴더에 직접 쓴다 (배포 환경에서는 동작하지 않음)
  console.warn(
    '[imageGeneration] SUPABASE_SERVICE_ROLE_KEY가 없어 로컬 파일로 저장합니다. ' +
      '배포 환경에서는 이 경로가 서빙되지 않으니 키를 설정하세요.'
  );
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), buffer);
  return `/generated/trends/${fileName}`;
}
