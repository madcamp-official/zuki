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
  '포토존':
    'A charming cafe photo zone corner: a decorated wall backdrop with fairy lights and pastel balloons, a small stool and a floral arrangement, no people',
};

const MENU_PROMPT: Record<string, string> = {
  // 실제 메뉴의 외형을 명시한다. 이름만 전달하면 모델이 신조어/지역명 메뉴를
  // 일반 크루아상이나 라테로 오해하는 문제가 있어 카드 이미지마다 구체화했다.
  '왁뿌소금빵':
    'Korean salt bread (sogeumbbang): one small oval, plump laminated bread roll with a distinctly flat rounded-rectangle silhouette, golden butter-brown crust, visible flaky layers along its side, a few coarse sea-salt crystals on top. It is NOT a croissant: no crescent shape, no pointed tips, no twisted spiral layers',
  '씬쿠키':
    'A single ultra-thin, wide, crisp chocolate chip cookie with lacy caramelized edges and melted chocolate chunks',
  '샌드베이글':
    'A freshly cut sesame bagel sandwich stacked with cream cheese, smoked salmon, arugula, tomato, and thin red onion',
  '황치즈칩쿠키':
    'A thick golden-yellow cheddar cheese chip cookie, craggy crisp edge, visible melted cheese pieces, one cookie only',
  '와그작케이크':
    'A playful crunchy crumble cake slice, soft cream layers coated in chunky cookie crumbs and crisp cereal pieces',
  '사라다빵':
    'Classic Korean salad bread: a soft oblong milk-bread roll split open and generously filled with creamy potato salad, shredded cabbage, carrot and corn',
  '크로플':
    'A golden croffle: a croissant pressed in a waffle iron, square grid pattern with flaky pastry layers, topped with a small pat of butter',
  '무화과 타르트':
    'An elegant fig tart with a crisp butter pastry shell, vanilla custard, and fresh quartered purple figs',
  '텐라떼':
    'A clear glass of iced ten latte, espresso and pale milk visibly layered, lots of ice, soft cream foam',
  '글레이즈드라떼':
    'A clear iced latte with glossy vanilla glaze drizzled on the inside of the glass and a light whipped cream cap',
  '우유빙수':
    'Korean milk bingsu: a snowy mound of finely shaved milk ice in a ceramic bowl, topped with condensed milk and a small scoop of vanilla ice cream',
  '신상아이스크림':
    'A premium new-release soft serve ice cream swirl in a small pastel cup, colorful fruit garnish',
  '쌀케이크':
    'A Korean rice cake dessert: neat soft white rice-cake layers with a subtle pale cream filling and a small strawberry garnish',
  '찰떡파이':
    'A Korean chaltteok pie: round chocolate-coated cake with a chewy white mochi center visibly cut open',
  '단팥빵':
    'A round glossy Korean sweet red-bean bun, split open to reveal dense dark-red adzuki bean paste',
  '땅콩빵':
    'Korean peanut bread: a small peanut-shell-shaped golden cake, cut open to show creamy peanut filling',
  '참붕어빵':
    'Korean fish-shaped taiyaki pastry, golden crisp fish silhouette, one piece with red bean filling slightly visible',
  '쫀득빵':
    'A soft chewy Korean bread roll, glossy golden surface, torn open to show a stretchy dense mochi-like interior',
  '120겹파이':
    'A dramatic mille-feuille made of many extremely thin, crisp golden pastry layers with light cream between them, cut as a neat rectangular slice',
  '초코파이':
    'A classic Korean choco pie: a round soft cake sandwich with marshmallow filling, fully coated in glossy dark chocolate, one bite taken to reveal the white marshmallow inside',
  '아이스티':
    'A tall glass of iced black tea, deep amber-red color, lots of ice cubes, a lemon slice on the rim, condensation on the glass',
  '크리미라떼':
    'An iced latte in a clear glass with an extra-thick layer of silky creamy milk foam on top, smooth espresso visible beneath',
  '밀크티':
    'A cup of milky Taiwanese-style milk tea, pale caramel-brown color, in a clear cup with visible tea swirl, no tapioca pearls',
  '건강빵':
    'A rustic multigrain health bread loaf, dense dark crust covered in visible oats, seeds and grains, sliced to show a hearty grainy crumb',
  '감자빵':
    'A round Korean potato bread: a soft pale bun shaped and dusted like a real potato with cocoa powder speckles, split open to reveal creamy potato-cheese filling',
  '말차':
    'A bowl of whisked Japanese matcha, vivid vibrant green frothy surface, traditional ceramic tea bowl, bamboo whisk resting beside it',
  '녹차':
    'A cup of brewed Korean green tea, clear pale-green liquid, simple white ceramic cup, a few loose tea leaves visible',
  '아메리카노':
    'A cup of iced americano, dark rich coffee over clear ice cubes in a tall glass, condensation on the glass, minimal styling',
  '에그타르트':
    'A classic Portuguese-style egg tart: flaky golden pastry shell filled with smooth custard, caramelized dark spots on top, one tart as the main subject',
  '홍차':
    'A cup of brewed black tea, deep reddish-amber color, elegant white teacup and saucer, a lemon wedge on the side',
  '초코쿠키':
    'A thick chewy double chocolate cookie, cracked glossy top, melted dark chocolate chunks visible, one cookie only',
  '두바이초콜릿':
    'Dubai chocolate bar, thick chocolate shell cut open to reveal bright green pistachio cream filling with crispy shredded kataifi pastry strands',
  '애플파이':
    'A classic American apple pie slice, golden lattice or crimped crust, cinnamon-spiced apple filling visible, warm and glossy',
  '버블티':
    'A cup of milk tea bubble tea with a thick layer of black tapioca pearls visible at the bottom through a clear plastic cup, wide straw',
  '미트파이':
    'A savory meat pie with a golden flaky crust, cut open to reveal a rich meat and gravy filling',
  '생크림빵':
    'A soft Korean cream bun: a plain milk bread roll split open and generously filled with plain whipped fresh cream, no fruit, dusted lightly with powdered sugar',
  '흑임자 크림라떼':
    'An iced black sesame cream latte in a clear glass, pale grey-purple color, thick whipped black sesame cream on top with a sprinkle of black sesame seeds',
  '바닐라라떼':
    'An iced vanilla latte in a clear glass, creamy pale coffee color, light vanilla bean flecks visible, condensation on the glass',
  '요거트 아이스크림':
    'A swirl of tangy soft-serve yogurt ice cream in a cup, pale creamy white color, topped with a few fresh berries',
  '떡케이크':
    'A Korean rice cake (tteok) styled as a layered celebration cake, soft white rice-cake tiers with pastel cream between layers, small fruit garnish on top',
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

/** 이미지 프롬프트에 참고 자료로 넣을 실제 게시물 근거 (뉴스/블로그 제목+발췌) */
export interface ImageEvidenceItem {
  title: string;
  excerpt: string;
}

/**
 * 자동 발굴된 키워드("돼지게티", "씬쿠키" 같은 신조어)는 MENU_PROMPT에 없어서
 * summary 한 줄만으로 GPT가 생김새를 상상해서 그리다 보니 엉뚱한 결과가 나온다.
 *
 * trendContent.ts가 이미 검색해둔 실제 뉴스/블로그 본문 발췌(evidence)를 함께
 * 넘기면, "이 키워드가 실제로 어떤 음식인지" 원문에서 힌트를 얻어 더 정확하게
 * 그릴 수 있다. 추가 검색 API 호출 없이 이미 가진 데이터를 재사용한다.
 */
function describeFromEvidence(
  title: string,
  evidence: ImageEvidenceItem[],
): string | null {
  if (evidence.length === 0) return null;

  const excerpts = evidence
    .slice(0, 3)
    .map((e) => `- ${e.title}: ${e.excerpt}`)
    .join('\n');

  return (
    `Reference material about "${title}" from real news/blog posts ` +
    `(use this to understand what this actually looks like, ` +
    `do not include any of this text in the image itself):\n${excerpts}`
  );
}

export function buildTrendImagePrompt(
  title: string,
  categorySlug: string,
  summary: string | null,
  evidence: ImageEvidenceItem[] = [],
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
  const reference = describeFromEvidence(title, evidence);

  return [
    `A ${kind} called "${title}" (${detail}), photographed as the main subject.`,
    reference,
    COMMON_STYLE,
  ]
    .filter(Boolean)
    .join(' ');
}

// 홈 히어로 배너 전용 스타일. 카드 이미지(COMMON_STYLE)는 정사각형 상품컷이라
// 배너에 그대로 쓰면 밋밋하다 — 가로 구도에 장식 요소를 더해 "1위" 느낌을 낸다.
const BANNER_STYLE =
  'Ultra realistic commercial food photography for a wide hero banner, ' +
  'dynamic diagonal composition with the food slightly off-center, ' +
  'dramatic soft studio lighting, shallow depth of field, ' +
  'floating decorative elements around the food matching its main ingredient ' +
  '(e.g. fruit pieces, powder, steam, or drizzle), subtle sparkle accents, ' +
  'warm vibrant colors, glossy appetizing texture, high-end dessert magazine cover quality, ' +
  '8k, no text, no watermark, no logo, no people, wide 16:9 crop, ' +
  'premium and celebratory mood fit for a "#1 trending" banner.';

/** 카드용 프롬프트를 재사용하되 배너 전용 스타일/비율로 다시 감싼다 */
export function buildBannerImagePrompt(
  title: string,
  categorySlug: string,
  summary: string | null,
  evidence: ImageEvidenceItem[] = [],
): string {
  const cardPrompt = buildTrendImagePrompt(title, categorySlug, summary, evidence);
  const subject = cardPrompt.slice(0, cardPrompt.indexOf(COMMON_STYLE)).trim();
  return `${subject} ${BANNER_STYLE}`;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }
    client = new OpenAI({
      apiKey,
      // 자동 생성은 수십 개를 순서대로 처리한다. 한 요청이 무한 대기하면
      // 이후 카드 전부가 기본 이미지로 남기 때문에 항목 단위로 실패 처리한다.
      timeout: Number(process.env.OPENAI_IMAGE_TIMEOUT_MS ?? 120_000),
      maxRetries: 2,
    });
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

/** OpenAI로 이미지를 생성해 버퍼로 받고, Storage(또는 로컬 폴백)에 올려 URL을 돌려준다 */
async function generateAndStore(
  prompt: string,
  fileName: string,
  size: '1024x1024' | '1536x1024',
): Promise<string> {
  /**
   * 모델·품질은 환경변수로 조정 가능. 장당 대략 비용(1024x1024, medium 기준):
   *   gpt-image-1       $0.042   (2026-10-23 지원 종료 예정)
   *   gpt-image-1.5     $0.034
   *   gpt-image-1-mini  $0.011
   * 카드 10개 생성 시 $0.11 ~ $0.42 수준이다.
   * 배너(1536x1024)는 이보다 비싸므로 1위가 바뀔 때만 생성한다.
   */
  const result = await getClient().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
    prompt,
    size,
    quality: (process.env.OPENAI_IMAGE_QUALITY ?? 'medium') as 'low' | 'medium' | 'high',
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI 응답에 이미지 데이터가 없습니다.');
  }

  const buffer = Buffer.from(b64, 'base64');

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
  evidence: ImageEvidenceItem[] = [],
): Promise<string> {
  const prompt = buildTrendImagePrompt(title, categorySlug, summary, evidence);
  return generateAndStore(prompt, `trend-${trendId}.png`, '1024x1024');
}

/**
 * 홈 히어로 배너 전용 이미지를 생성한다. 1위 트렌드가 바뀔 때만 호출되므로
 * (autoTrends.ts 참고) 매 요청마다 과금되지 않는다.
 */
export async function generateBannerImage(
  trendId: string | number,
  title: string,
  categorySlug: string,
  summary: string | null,
  evidence: ImageEvidenceItem[] = [],
): Promise<string> {
  const prompt = buildBannerImagePrompt(title, categorySlug, summary, evidence);
  return generateAndStore(prompt, `banner-${trendId}.png`, '1536x1024');
}
