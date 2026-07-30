/**
 * 트렌드 카드의 즐겨찾기(북마크) 버튼 아이콘을 OpenAI로 생성하는 1회성 스크립트.
 * 실행: cd backend && npx ts-node scripts/generate-bookmark-icon.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const OUTPUT_DIR = path.resolve(__dirname, '../../frontend/public/generated/icons');

const PROMPT =
  'A single simple bookmark ribbon icon, flat vector-style illustration, ' +
  'solid warm strawberry-red color (#ff4d6d), minimalist, clean rounded shape, ' +
  'no text, no shadow, no gradient, centered, small UI icon for a website button, ' +
  'transparent background, icon design only.';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 .env에 없습니다.');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const client = new OpenAI({ apiKey });

  console.log('북마크 아이콘 생성 중...');
  const result = await client.images.generate({
    model: 'gpt-image-1',
    prompt: PROMPT,
    size: '1024x1024',
    quality: 'medium',
    background: 'transparent',
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('이미지 데이터가 응답에 없습니다.');
  }

  const filePath = path.join(OUTPUT_DIR, 'bookmark-icon.png');
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  console.log(`완료: ${filePath}`);
}

main().catch((err) => {
  console.error('스크립트 실패:', err);
  process.exit(1);
});
