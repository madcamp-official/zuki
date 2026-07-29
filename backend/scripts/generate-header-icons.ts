/**
 * 헤더의 검색/알림 아이콘을 OpenAI로 생성하는 1회성 스크립트.
 * 실행: cd backend && npx ts-node scripts/generate-header-icons.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const OUTPUT_DIR = path.resolve(__dirname, '../../frontend/public/generated/icons');

const COMMON_STYLE =
  'flat vector-style icon illustration, solid warm gray color (#6b7280), ' +
  'minimalist, clean rounded line style, no text, no shadow, no gradient, ' +
  'centered, small UI icon for a website header button, transparent background, ' +
  'icon design only, consistent stroke width.';

const ICONS: { name: string; prompt: string }[] = [
  {
    name: 'search-icon',
    prompt: `A single simple magnifying glass (search) icon. ${COMMON_STYLE}`,
  },
  {
    name: 'bell-icon',
    prompt: `A single simple bell (notification) icon. ${COMMON_STYLE}`,
  },
];

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 .env에 없습니다.');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const client = new OpenAI({ apiKey });

  for (const icon of ICONS) {
    console.log(`${icon.name} 생성 중...`);
    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt: icon.prompt,
      size: '1024x1024',
      quality: 'medium',
      background: 'transparent',
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error(`${icon.name}: 이미지 데이터가 응답에 없습니다.`);
    }

    const filePath = path.join(OUTPUT_DIR, `${icon.name}.png`);
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
    console.log(`  완료: ${filePath}`);
  }
}

main().catch((err) => {
  console.error('스크립트 실패:', err);
  process.exit(1);
});
