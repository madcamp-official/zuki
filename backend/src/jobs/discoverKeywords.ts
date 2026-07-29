import { query } from '../db/client';
import {
  DiscoveredKeyword,
  DiscoveryResult,
  NAVER_ARCHIVE_QUERIES,
  NAVER_DISCOVERY_QUERIES,
  discoverFromNaver,
  discoverFromYoutube,
} from '../services/keywordDiscovery';

/**
 * 아카이브 발굴은 최대 깊이로 판다.
 *
 * 회고 글은 애초에 드물어서 얕게 훑으면 몇 건 안 나온다. 33개 검색어 ×
 * 10페이지 × 2코퍼스 = 660회로, 네이버 하루 한도(25,000)의 2.6%다.
 * 자주 돌릴 일이 없는 작업이라 한 번에 최대로 캐는 게 낫다.
 */
const ARCHIVE_PAGES = 10;

/**
 * 후보 키워드 발굴 배치.
 *
 * 원래 adminController 안에 있던 로직을 job으로 옮겼다. 스케줄러와 관리자 API가
 * 같은 코드를 써야 "버튼으로 눌렀을 때"와 "자동으로 돌 때"의 결과가 갈리지 않는다.
 */

export interface DiscoveryJobOptions {
  /** 유튜브 검색 포함 여부. 쿼리당 101 unit이라 매번 켜면 할당량이 빠르게 준다 */
  youtube?: boolean;
  blog?: boolean;
  cafe?: boolean;
  /**
   * 네이버 쿼리당 몇 페이지(100건)까지 볼지. 기본 5.
   * 후보를 크게 늘리고 싶을 때 올린다 (최대 10, API의 start 상한 때문).
   */
  pages?: number;
  /**
   * 지난 유행 발굴 모드.
   *
   * 평소 발굴은 최신순으로 "지금 뜨는 것"을 찾는다. 그 방식으로는 이미 식은
   * 메뉴가 구조적으로 안 잡힌다 — 지금 아무도 글을 안 쓰니까.
   * 이 모드는 회고 검색어를 정확도순으로 깊게 훑어서, 오래전 글에 남아 있는
   * 과거 유행 키워드를 캐낸다. 유튜브는 최근 30일만 보므로 의미가 없어 쓰지 않는다.
   */
  archive?: boolean;
}

export interface DiscoveryJobSummary {
  discovered: number;
  inserted: number;
  updated: number;
  /** 이번 실행에서 2개 이상 소스에 동시에 잡힌 키워드 수 */
  multiSource: number;
  errors: string[];
  sources: Record<string, unknown>;
}

export async function runKeywordDiscovery(
  options: DiscoveryJobOptions = {}
): Promise<DiscoveryJobSummary> {
  const { blog = true, cafe = true, pages, archive = false } = options;
  // 아카이브 모드는 오래된 글을 뒤지는 게 목적이라 유튜브(최근 30일)는 제외한다
  const youtube = archive ? false : options.youtube !== false;

  // 아카이브는 회고 검색어를 정확도순으로, 기본보다 깊게 훑는다
  const queries = archive ? NAVER_ARCHIVE_QUERIES : NAVER_DISCOVERY_QUERIES;
  const sort: 'date' | 'sim' = archive ? 'sim' : 'date';
  const pageCount = pages ?? (archive ? ARCHIVE_PAGES : undefined);

  const discovered: DiscoveredKeyword[] = [];
  const errors: string[] = [];
  const sources: Record<string, unknown> = {};

  /** 소스 하나를 실행하고 실패를 요약에 담는다 (조용히 넘어가지 않도록) */
  async function run(name: string, fn: () => Promise<DiscoveryResult>) {
    try {
      const result = await fn();
      discovered.push(...result.keywords);
      sources[name] = {
        titlesScanned: result.titlesScanned,
        extracted: result.keywords.length,
        attempts: result.attempts,
      };
      for (const a of result.attempts.filter((x) => !x.ok)) {
        errors.push(`${a.target} 조회 실패: ${a.error}`);
      }
      if (result.titlesScanned === 0) {
        errors.push(`${name}에서 제목을 하나도 가져오지 못했습니다. API 키/할당량을 확인하세요.`);
      }
    } catch (err) {
      errors.push(`${name} 발굴 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (blog) await run('blog', () => discoverFromNaver('blog', queries, pageCount, sort));
  if (cafe) await run('cafe', () => discoverFromNaver('cafearticle', queries, pageCount, sort));
  if (youtube) await run('youtube', () => discoverFromYoutube());

  /**
   * 소스별로 합치되 "어느 소스에서 나왔는지"를 보존한다.
   *
   * 한 소스에서만 잡힌 키워드는 그 소스의 편향일 수 있다. 개인 카페·빵집
   * 이름이 대개 블로그 한 곳에서만 나온다는 점에서, 소스 수는 가게 이름
   * 노이즈를 걸러내는 지표로도 쓰인다.
   */
  const merged = new Map<
    string,
    { sources: Set<string>; bySource: Record<string, number>; total: number }
  >();

  for (const d of discovered) {
    const entry = merged.get(d.keyword) ?? { sources: new Set<string>(), bySource: {}, total: 0 };
    entry.sources.add(d.source);
    entry.bySource[d.source] = (entry.bySource[d.source] ?? 0) + d.mentionCount;
    entry.total += d.mentionCount;
    merged.set(d.keyword, entry);
  }

  let inserted = 0;
  let updated = 0;

  for (const [keyword, entry] of merged) {
    const sourceList = [...entry.sources];
    // keyword는 VARCHAR(50) UNIQUE.
    //
    // sources는 덮어쓰지 않고 **합집합**으로 누적한다. 발굴은 매번 각 소스의
    // 최신 글만 훑기 때문에, 오늘 블로그에서 잡힌 키워드가 내일은 카페에서만
    // 잡힐 수 있다. 덮어쓰면 소스 수가 1↔2를 오가고, 그때마다 교차검증을 통과했다
    // 못했다 하면서 카드가 깜빡인다. "이 단어가 여러 소스에서 쓰이는가"는
    // 그 단어의 성질이지 오늘 어느 소스에 떴는지의 문제가 아니다.
    //
    // 반면 mention_count는 덮어쓴다. "지금 얼마나 회자되는가"를 재는 값이라
    // 누적하면 오래된 키워드가 무조건 커진다.
    const rows = await query<{ id: number; is_new: boolean }>(
      `INSERT INTO keywords (keyword, source, sources, mention_count, mention_by_source, discovered_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ON CONFLICT (keyword) DO UPDATE
         SET sources           = ARRAY(
                                   SELECT DISTINCT unnest(
                                     COALESCE(keywords.sources, '{}') || EXCLUDED.sources
                                   )
                                 ),
             mention_count     = EXCLUDED.mention_count,
             mention_by_source = EXCLUDED.mention_by_source,
             discovered_at     = now()
       RETURNING id, (xmax = 0) AS is_new`,
      [
        keyword.slice(0, 50),
        sourceList[0],
        sourceList,
        entry.total,
        JSON.stringify(entry.bySource),
      ]
    );
    if (rows[0]?.is_new) inserted += 1;
    else updated += 1;
  }

  const multiSource = [...merged.values()].filter((e) => e.sources.size >= 2).length;

  console.log(
    `[discover] 후보 ${merged.size}개 (신규 ${inserted} / 갱신 ${updated}) · ` +
      `이번 실행 다중소스 ${multiSource}${errors.length ? ` · 오류 ${errors.length}` : ''}`
  );

  return { discovered: merged.size, inserted, updated, multiSource, errors, sources };
}
