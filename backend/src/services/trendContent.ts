import OpenAI from 'openai';
import { NaverSearchItem, searchNaver } from './naverSearch';

/**
 * 트렌드 카드 문구 자동 생성
 *
 * === 환각을 막는 것이 이 파일의 핵심 목적이다 ===
 *
 * "왜 뜨는지"를 LLM에게 자유롭게 쓰게 하면 그럴듯한 거짓말을 만들어낸다.
 * 씬쿠키가 실제로 왜 뜨는지 모르는 상태에서 "일본 여행 인구 증가로..." 같은
 * 문장이 나오는데, 사장님이 이걸 근거로 메뉴를 결정하면 곤란하다.
 *
 * 그래서 두 가지 자료만 주고, 그 안에 있는 내용만 옮기게 한다:
 *
 *   1) 우리가 직접 측정한 수치 (검색 증감률, 게시량 변화 등)
 *   2) 그 키워드를 실제로 다룬 뉴스·블로그의 제목과 본문 발췌
 *
 * 2번이 핵심이다. 수치만으로는 "얼마나 뜨는지"는 알아도 "왜 뜨는지"는 모른다.
 * 실제 글을 읽어오면 원인이 거기 적혀 있는 경우가 많고(신제품 출시, 화제성),
 * 그러면 LLM이 하는 일은 창작이 아니라 요약이 된다. 게시물에 원인이 없으면
 * 추측하지 말고 지표만 서술하게 한다.
 *
 *   X "최근 일본 디저트 유행과 맞물려"        (아무 자료에도 없는 창작)
 *   O "편의점 3사가 이달 신제품으로 출시했고"  (뉴스 기사에 실제로 있는 내용)
 *   O "최근 7일 블로그 게시량이 2배 늘었습니다" (우리가 측정한 값)
 *
 * 근거가 된 게시물 링크는 카드에 함께 저장해, 사장님이 원문을 확인할 수 있게 한다.
 * 모델이 없거나 호출이 실패해도 카드 생성이 막히면 안 되므로 폴백을 준비해둔다.
 */

export interface TrendSignalInput {
  keyword: string;
  /** 네이버 검색지수 증감률(%) */
  searchGrowthRate: number | null;
  /** 블로그 게시 속도 변화(%) */
  mentionGrowthRate: number | null;
  /** 작년 같은 달 대비 증감률(%) */
  yoyGrowthRate: number | null;
  /** 최근 글 수 */
  mentionCount: number;
  /** 어느 소스에서 잡혔는지 */
  sources: string[];
  /** 현재 검색지수 (0~100) */
  searchIndex: number | null;
  /** 유튜브 일평균 조회수 */
  viewVelocity: number | null;
}

export interface EvidenceItem {
  title: string;
  excerpt: string;
  link: string;
  date: string | null;
  corpus: 'news' | 'blog' | 'cafe';
}

export interface GeneratedTrendContent {
  summary: string;
  reason: string;
  /** LLM을 실제로 썼는지. false면 규칙 기반 폴백 */
  generated: boolean;
  /** 문구의 근거가 된 실제 게시물들. 사장님이 원문을 확인할 수 있어야 한다 */
  evidence: EvidenceItem[];
}

/**
 * 키워드에 대한 실제 게시물을 모은다 — 문구의 근거가 될 원문.
 *
 * 수치("검색량 167% 증가")만으로는 "얼마나 뜨는지"는 알아도 "왜 뜨는지"는 모른다.
 * 그렇다고 LLM에게 원인을 추측하게 하면 거짓말을 만들어낸다.
 *
 * 그래서 그 키워드를 실제로 다룬 글을 읽어온다. 뉴스는 배경 설명이 있는 경우가
 * 많고(신제품 출시, 화제성), 블로그는 사람들이 실제로 뭐라고 말하는지 보여준다.
 * LLM은 이 텍스트 안에 있는 내용만 옮기게 하므로 창작이 아니라 요약이 된다.
 *
 * 비용: 키워드당 네이버 검색 2회. 하루 25,000회 한도라 부담 없다.
 */
export async function gatherEvidence(
  keyword: string,
  perCorpus = 5
): Promise<EvidenceItem[]> {
  const out: EvidenceItem[] = [];

  const pick = (items: NaverSearchItem[], corpus: EvidenceItem['corpus']) =>
    items
      // 본문 발췌가 없으면 근거로 쓸 수 없다
      .filter((i) => i.description && i.description.length > 20)
      .slice(0, perCorpus)
      .map((i) => ({
        title: i.title,
        excerpt: i.description.slice(0, 300),
        link: i.link,
        date: i.postDate,
        corpus,
      }));

  // 뉴스를 먼저 본다 — 배경(출시, 화제성, 유행 경위)이 담기는 경우가 많다.
  // 정확도순(sim)으로 뽑는다. 최신순이면 키워드가 본문에 스치기만 한 무관한
  // 기사가 근거로 들어간다(실측: '씬쿠키'에 F1 선수 기사가 걸렸다).
  try {
    const news = await searchNaver(keyword, 'news', 20, 1, 'sim');
    out.push(...pick(news.items, 'news'));
  } catch (err) {
    console.warn(`[trendContent] "${keyword}" 뉴스 검색 실패:`, err);
  }

  // 블로그도 근거로는 정확도순이 낫다 — 사람들이 그 메뉴에 대해 실제로 뭐라고
  // 쓰는지가 필요하지, 아무 최신 글이나 필요한 게 아니다.
  try {
    const blog = await searchNaver(keyword, 'blog', 20, 1, 'sim');
    out.push(...pick(blog.items, 'blog'));
  } catch (err) {
    console.warn(`[trendContent] "${keyword}" 블로그 검색 실패:`, err);
  }

  return out;
}

const SOURCE_LABEL: Record<string, string> = {
  blog: '네이버 블로그',
  cafe: '네이버 카페',
  youtube: '유튜브',
};

/** 측정값을 사람이 읽을 수 있는 문장 조각으로 바꾼다 */
function describeSignals(s: TrendSignalInput): string[] {
  const facts: string[] = [];

  if (s.mentionGrowthRate !== null) {
    const dir = s.mentionGrowthRate >= 0 ? '증가' : '감소';
    facts.push(`최근 7일 블로그 게시량이 그 이전 7일 대비 ${Math.abs(s.mentionGrowthRate)}% ${dir}`);
  }
  if (s.searchGrowthRate !== null) {
    const dir = s.searchGrowthRate >= 0 ? '증가' : '감소';
    facts.push(`네이버 검색량이 ${Math.abs(s.searchGrowthRate)}% ${dir}`);
  }
  if (s.yoyGrowthRate !== null) {
    facts.push(`작년 같은 달 대비 ${s.yoyGrowthRate}%`);
  }
  if (s.mentionCount > 0) {
    facts.push(`최근 관련 글 ${s.mentionCount}건`);
  }
  if (s.viewVelocity !== null && s.viewVelocity > 0) {
    facts.push(`유튜브 관련 영상 일평균 조회수 ${s.viewVelocity.toLocaleString()}회`);
  }
  if (s.sources.length > 0) {
    const labels = s.sources.map((x) => SOURCE_LABEL[x] ?? x).join(', ');
    facts.push(
      s.sources.length >= 2
        ? `${labels} 등 ${s.sources.length}개 채널에서 동시에 언급`
        : `${labels}에서 언급`
    );
  }
  if (s.searchIndex !== null) {
    facts.push(`현재 검색지수 ${s.searchIndex}`);
  }

  return facts;
}

/**
 * 측정값만으로 문구를 만든다 — 외부 호출 없이 즉시, 무료.
 *
 * 두 곳에서 쓴다:
 *   1) LLM이 없거나 실패했을 때의 폴백
 *   2) 카드가 많을 때 상위권이 아닌 것들의 기본 문구
 *      (전부 근거 수집 + LLM을 돌리면 카드당 10초 넘게 걸려 요청이 끊긴다)
 *
 * 방향을 문구에 반영한다. 하락 중인 메뉴에 "늘고 있습니다"라고 쓰면 안 된다.
 */
export function buildBasicContent(
  s: TrendSignalInput,
  evidence: EvidenceItem[] = []
): GeneratedTrendContent {
  const facts = describeSignals(s);
  const momentum = s.searchGrowthRate ?? s.mentionGrowthRate;

  let summary: string;
  if (momentum === null) {
    summary = `${s.keyword} 관련 지표를 수집하고 있습니다.`;
  } else if (momentum <= -15) {
    summary = `${s.keyword} 관련 검색과 언급이 줄고 있습니다.`;
  } else if (momentum >= 15) {
    summary = `${s.keyword} 관련 검색과 언급이 늘고 있습니다.`;
  } else {
    summary = `${s.keyword} 관련 지표가 큰 변화 없이 유지되고 있습니다.`;
  }

  return {
    summary,
    reason: facts.length > 0 ? facts.join('. ') + '.' : '수집된 지표가 아직 부족합니다.',
    generated: false,
    evidence,
  };
}

/** @deprecated buildBasicContent를 쓸 것. 이름만 남겨둔 별칭 */
const buildFallback = buildBasicContent;

/**
 * 트렌드 카드의 요약·배경 문구를 만든다.
 *
 * 실제 게시물을 먼저 검색해 근거로 넣고, 모델에게는 그 자료 밖의 내용을
 * 지어내지 못하게 한다.
 */
export async function generateTrendContent(
  signals: TrendSignalInput
): Promise<GeneratedTrendContent> {
  // 실제 게시물을 먼저 모은다. LLM이 없어도 근거 링크는 카드에 남길 수 있다.
  const evidence = await gatherEvidence(signals.keyword);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildFallback(signals, evidence);

  const facts = describeSignals(signals);
  if (facts.length === 0 && evidence.length === 0) return buildFallback(signals, evidence);

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            '너는 카페·베이커리 사장님에게 디저트/음료 트렌드를 알려주는 에디터다.',
            '',
            '자료는 두 종류가 주어진다:',
            '1) 관측된 지표 — 우리가 직접 측정한 수치',
            '2) 실제 게시물 — 그 키워드를 다룬 뉴스·블로그의 제목과 본문 발췌',
            '',
            '반드시 지킬 것:',
            '- 주어진 자료에 있는 내용만 쓴다. 자료 밖의 배경을 지어내지 마라.',
            '- 특히 유행의 원인은 "실제 게시물"에 실제로 적혀 있을 때만 언급한다.',
            '  게시물에 없으면 원인을 추측하지 말고, 관측된 지표만 서술한다.',
            '  (예: 게시물에 "편의점 출시"가 나오면 써도 되지만, 아무 데도 없는',
            '   "일본 여행 유행" 같은 건 절대 만들어내지 마라)',
            '- 숫자는 주어진 값을 그대로 쓴다. 과장하지 마라.',
            '- 특정 브랜드·매장 홍보처럼 읽히지 않게 한다.',
            '- 존댓말, 담백한 정보 전달 톤.',
            '',
            'JSON으로만 답한다: {"summary": "...", "reason": "..."}',
            '- summary: 한 문장, 40자 이내. 무엇이 어떻게 움직이는지.',
            '- reason: 두세 문장. 게시물에서 확인된 사실 + 관측된 지표.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `키워드: ${signals.keyword}`,
            '',
            '[관측된 지표]',
            ...(facts.length > 0 ? facts.map((f) => `- ${f}`) : ['- (없음)']),
            '',
            '[실제 게시물]',
            ...(evidence.length > 0
              ? evidence.map(
                  (e, i) =>
                    `${i + 1}. (${e.corpus}${e.date ? ` ${e.date}` : ''}) ${e.title}\n   ${e.excerpt}`
                )
              : ['(없음 — 이 경우 원인을 추측하지 말고 지표만 서술할 것)']),
          ].join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return buildFallback(signals, evidence);

    const parsed = JSON.parse(raw) as { summary?: string; reason?: string };
    if (!parsed.summary || !parsed.reason) return buildFallback(signals, evidence);

    return {
      summary: parsed.summary.slice(0, 200),
      reason: parsed.reason.slice(0, 1000),
      generated: true,
      evidence,
    };
  } catch (err) {
    // 문구 생성 실패가 카드 생성을 막으면 안 된다
    console.warn(`[trendContent] "${signals.keyword}" 생성 실패, 폴백 사용:`, err);
    return buildFallback(signals, evidence);
  }
}

/**
 * 키워드로 카테고리를 추정한다 (디저트 1 / 음료 2 / 마케팅 3).
 * 스키마의 categories 시드 순서를 따른다.
 */
const BEVERAGE_FORMS = [
  '라떼', '아메리카노', '에이드', '스무디', '프라페', '주스', '쉐이크', '티',
  '커피', '음료', '드링크', '차',
];

/** 마케팅은 메뉴가 아니라 활동/이벤트라 어미가 완전히 다르다 */
const MARKETING_FORMS = [
  '이벤트', '챌린지', '팝업', '팝업스토어', '콜라보', '굿즈', '마케팅',
  '프로모션', '클래스', '체험', '포토존', '스탬프', '쿠폰', '멤버십',
  '리유저블컵', '텀블러', '키링', '스티커', '뽑기', '럭키박스', '선물세트',
];

export function inferCategorySlug(keyword: string): 'beverage' | 'dessert' | 'marketing' {
  if (MARKETING_FORMS.some((f) => keyword.endsWith(f))) return 'marketing';
  if (BEVERAGE_FORMS.some((f) => keyword.endsWith(f))) return 'beverage';
  return 'dessert';
}
