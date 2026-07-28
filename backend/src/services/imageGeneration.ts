import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// frontend/public/generated/trends/에 저장 (스크립트 scripts/generate-trend-images.ts와 동일 경로 공유)
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
 * 트렌드 하나에 대해 OpenAI 이미지를 생성해 frontend/public/generated/trends/에 저장하고
 * 프론트에서 접근 가능한 상대 경로(/generated/trends/trend-{id}.png)를 반환한다.
 */
export async function generateTrendImage(
  trendId: string | number,
  title: string,
  categorySlug: string,
  summary: string | null,
): Promise<string> {
  const prompt = buildTrendImagePrompt(title, categorySlug, summary);

  const result = await getClient().images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
    quality: 'medium',
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI 응답에 이미지 데이터가 없습니다.');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const fileName = `trend-${trendId}.png`;
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), Buffer.from(b64, 'base64'));

  return `/generated/trends/${fileName}`;
}
