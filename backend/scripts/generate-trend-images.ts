/**
 * DB의 트렌드 전체에 대해 OpenAI로 프리미엄 베이커리 광고풍 실사 이미지를 생성해
 * frontend/public/generated/trends/에 저장하고 trends.image_url을 업데이트하는
 * 1회성 스크립트.
 *
 * 실행: cd backend && npx ts-node scripts/generate-trend-images.ts
 * 옵션: --only=13,17  (특정 id만 다시 생성하고 싶을 때)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { getPool, query } from '../src/db/client';

const OUTPUT_DIR = path.resolve(__dirname, '../../frontend/public/generated/trends');

// 카드 여러 장을 나열해도 같은 브랜드에서 찍은 것처럼 보이도록 공통 스타일을 고정
const COMMON_STYLE =
  'Ultra realistic, premium bakery advertisement, commercial food photography, ' +
  'centered composition, isolated food, warm cream beige background, ' +
  'soft diffused studio lighting, shallow depth of field, vibrant but warm colors, ' +
  'glossy texture, highly detailed, food magazine quality, 8k, minimal props, ' +
  'food fills most of the frame, clean composition, no text, no watermark, no logo, ' +
  'no people, square crop, perfect for a website card.';

// 음료/디저트: 실제 메뉴 사진처럼. 마케팅: 음식이 아니라 활동/사물이라 별도 지정
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

function buildPrompt(
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

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 .env에 없습니다.');
  }

  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyIds = onlyArg
    ? onlyArg.replace('--only=', '').split(',').map(Number)
    : null;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const client = new OpenAI({ apiKey });

  const rows = await query<{
    id: string;
    title: string;
    summary: string | null;
    category_slug: string;
  }>(
    `SELECT t.id, t.title, t.summary, c.slug AS category_slug
       FROM trends t
       JOIN categories c ON c.id = t.category_id
      ORDER BY t.id ASC`,
  );

  const trends = onlyIds
    ? rows.filter((t) => onlyIds.includes(Number(t.id)))
    : rows;

  console.log(`대상 트렌드 ${trends.length}개`);

  for (const trend of trends) {
    const prompt = buildPrompt(trend.title, trend.category_slug, trend.summary);
    console.log(`\n[${trend.id}] ${trend.title} 생성 중...`);
    console.log(`  prompt: ${prompt}`);

    try {
      const result = await client.images.generate({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        quality: 'medium',
        n: 1,
      });

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error('이미지 데이터가 응답에 없습니다.');
      }

      const fileName = `trend-${trend.id}.png`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));

      const publicUrl = `/generated/trends/${fileName}`;
      await query('UPDATE trends SET image_url = $1 WHERE id = $2', [
        publicUrl,
        trend.id,
      ]);

      console.log(`  완료: ${publicUrl}`);
    } catch (err) {
      console.error(`  실패 [${trend.id}] ${trend.title}:`, err instanceof Error ? err.message : err);
    }
  }

  await getPool().end();
  console.log('\n전체 완료');
}

main().catch((err) => {
  console.error('스크립트 실패:', err);
  process.exit(1);
});
