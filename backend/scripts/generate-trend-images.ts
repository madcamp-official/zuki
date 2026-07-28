/**
 * DB의 트렌드 전체(또는 --only로 지정한 일부)에 대해 OpenAI로 프리미엄 베이커리
 * 광고풍 실사 이미지를 생성해 frontend/public/generated/trends/에 저장하고
 * trends.image_url을 업데이트하는 스크립트.
 *
 * 신규 트렌드는 관리자 API(POST /api/admin/trends)가 자동으로 이미지를 생성하므로
 * (services/imageGeneration.ts), 이 스크립트는 과거 데이터 일괄 재생성이나
 * 특정 트렌드 재시도 용도로 쓴다.
 *
 * 실행: cd backend && npx ts-node scripts/generate-trend-images.ts
 * 옵션: --only=13,17  (특정 id만 다시 생성하고 싶을 때)
 */
import 'dotenv/config';
import { getPool, query } from '../src/db/client';
import { generateTrendImage } from '../src/services/imageGeneration';

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 .env에 없습니다.');
  }

  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyIds = onlyArg
    ? onlyArg.replace('--only=', '').split(',').map(Number)
    : null;

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
    console.log(`\n[${trend.id}] ${trend.title} 생성 중...`);
    try {
      const publicUrl = await generateTrendImage(
        trend.id,
        trend.title,
        trend.category_slug,
        trend.summary,
      );
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
