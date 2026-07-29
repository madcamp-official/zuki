import { query } from '../db/client';
import { generateTrendImage, generateBannerImage } from '../services/imageGeneration';
import { generateTrendContent, inferCategorySlug } from '../services/trendContent';
import { classifyStatus } from '../services/scoring';

/**
 * 상위 트렌드 자동 갱신
 *
 * 급상승 후보 중 신호가 강한 것들을 트렌드 카드로 자동 생성하고,
 * 순위에서 밀린 자동 카드는 내려서 항상 최신 상위 N개가 노출되게 한다.
 *
 * 에디터가 직접 만든 카드(is_auto=false)는 건드리지 않는다.
 * 자동 카드만 교체 대상이다.
 */

export interface AutoTrendSummary {
  startedAt: string;
  finishedAt: string;
  /** 후보로 검토한 키워드 수 */
  considered: number;
  created: number;
  /** 이미 카드가 있어 문구만 갱신한 수 */
  refreshed: number;
  /** 순위에서 밀려 내린 자동 카드 수 */
  retired: number;
  /** 함께 내린 수동 더미 카드 수 (retireManual=true일 때만) */
  retiredManual: number;
  errors: { keyword: string; message: string }[];
  trends: {
    id: number;
    keyword: string;
    signal: number;
    /** LLM이 문구를 썼는지 (false면 규칙 기반 폴백) */
    generated: boolean;
    /** 문구의 근거가 된 실제 게시물 수 */
    evidenceCount: number;
  }[];
}

interface Candidate {
  id: number;
  keyword: string;
  trend_id: number | null;
  sources: string[];
  mention_count: number;
  search_index: string | null;
  growth_rate: string | null;
  mention_growth_rate: string | null;
  yoy_growth_rate: string | null;
  view_velocity: string | null;
  trend_signal: string;
}

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * @param topN 유지할 자동 카드 수
 * @param minSignal 이 점수 미만은 카드로 만들지 않는다 (노이즈 배제)
 * @param withImage OpenAI 이미지 생성 여부. 호출당 과금되므로 끌 수 있게 둔다
 * @param retireManual 손으로 만든 카드(더미 포함)도 함께 내릴지.
 *   기본은 false — 에디터가 공들여 쓴 카드를 실수로 날리면 안 되기 때문이다.
 *   시드 더미를 걷어내고 실제 수집 데이터만 보이게 할 때 true로 쓴다.
 *   삭제가 아니라 발행 취소라 언제든 되살릴 수 있다.
 */
export async function refreshAutoTrends(
  topN = 10,
  minSignal = 40,
  withImage = true,
  retireManual = false
): Promise<AutoTrendSummary> {
  const startedAt = new Date();
  const summary: AutoTrendSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    considered: 0,
    created: 0,
    refreshed: 0,
    retired: 0,
    retiredManual: 0,
    errors: [],
    trends: [],
  };

  // 급상승 후보를 신호 순으로 가져온다.
  // listRisingKeywords와 같은 기준을 쓰되, 이미 카드가 있는 것도 포함해서
  // (includeLinked) 기존 자동 카드의 문구·점수를 갱신할 수 있게 한다.
  const candidates = await query<Candidate>(
    `WITH latest_index AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
        WHERE source_type='naver' AND metric_type='search_index'
        ORDER BY keyword_id, collected_date DESC),
     latest_growth AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
        WHERE source_type='naver' AND metric_type='search_growth_rate'
        ORDER BY keyword_id, collected_date DESC),
     latest_mention_growth AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
        WHERE source_type='naver' AND metric_type='mention_growth_rate'
        ORDER BY keyword_id, collected_date DESC),
     latest_velocity AS (
       SELECT DISTINCT ON (keyword_id) keyword_id, value FROM keyword_metrics
        WHERE source_type='youtube' AND metric_type='view_velocity'
        ORDER BY keyword_id, collected_date DESC)
     SELECT k.id, k.keyword, k.trend_id, k.sources, k.mention_count,
            li.value AS search_index,
            lg.value AS growth_rate,
            lmg.value AS mention_growth_rate,
            k.yoy_growth_rate::text AS yoy_growth_rate,
            lv.value AS view_velocity,
            ROUND(
              (LEAST(GREATEST(COALESCE(lmg.value,0),-100),200) + 100)/300.0*45
              + (LEAST(GREATEST(COALESCE(lg.value,0),-50),50) + 50)/100.0*30
              + LEAST(COALESCE(array_length(k.sources,1),0),3)/3.0*25
            , 2)::text AS trend_signal
       FROM keywords k
       JOIN latest_index li ON li.keyword_id = k.id
       LEFT JOIN latest_growth lg ON lg.keyword_id = k.id
       LEFT JOIN latest_mention_growth lmg ON lmg.keyword_id = k.id
       LEFT JOIN latest_velocity lv ON lv.keyword_id = k.id
      WHERE li.value >= 5
        AND k.mention_count >= 2
        AND k.is_seasonal = false
        AND NOT (li.value >= 40 AND COALESCE(lg.value, 0) < 5)
      ORDER BY trend_signal DESC, k.mention_count DESC
      LIMIT $1`,
    [topN]
  );

  summary.considered = candidates.length;

  const keptTrendIds: number[] = [];

  for (const c of candidates) {
    const signal = Number(c.trend_signal);
    if (signal < minSignal) continue;

    try {
      const signalInput = {
        keyword: c.keyword,
        searchGrowthRate: num(c.growth_rate),
        mentionGrowthRate: num(c.mention_growth_rate),
        yoyGrowthRate: num(c.yoy_growth_rate),
        mentionCount: c.mention_count,
        sources: c.sources ?? [],
        searchIndex: num(c.search_index),
        viewVelocity: num(c.view_velocity),
      };

      const content = await generateTrendContent(signalInput);

      // 확산 단계는 수집 지표로 판정 (자동 카드도 같은 기준을 쓴다)
      const status = classifyStatus({
        searchLevel: signalInput.searchIndex,
        searchMomentum: signalInput.searchGrowthRate,
        youtubeMomentum: null,
        editorScore: 50,
      });

      if (c.trend_id) {
        // 이미 카드가 있으면 문구와 점수만 갱신한다.
        // 에디터가 만든 카드(is_auto=false)의 문구는 덮어쓰지 않는다.
        const [updated] = await query<{ id: number }>(
          `UPDATE trends
              SET summary     = CASE WHEN is_auto THEN $2 ELSE summary END,
                  reason      = CASE WHEN is_auto THEN $3 ELSE reason END,
                  evidence    = CASE WHEN is_auto THEN $6::jsonb ELSE evidence END,
                  status      = $4,
                  score       = $5,
                  auto_signal = $5,
                  is_published = true,
                  updated_at  = now()
            WHERE id = $1
            RETURNING id`,
          [c.trend_id, content.summary, content.reason, status, signal, JSON.stringify(content.evidence)]
        );
        if (updated) {
          keptTrendIds.push(c.trend_id);
          summary.refreshed += 1;
          summary.trends.push({
            id: c.trend_id,
            keyword: c.keyword,
            signal,
            generated: content.generated,
            evidenceCount: content.evidence.length,
          });
        }
        continue;
      }

      // 새 카드 생성
      const categorySlug = inferCategorySlug(c.keyword);
      const [category] = await query<{ id: number }>(
        `SELECT id FROM categories WHERE slug = $1`,
        [categorySlug]
      );

      const [trend] = await query<{ id: number }>(
        `INSERT INTO trends
           (title, summary, reason, evidence, category_id, status, score,
            region_scope, primary_source, is_published, is_auto, auto_signal)
         VALUES ($1, $2, $3, $7::jsonb, $4, $5, $6, 'nationwide', 'naver', true, true, $6)
         RETURNING id`,
        [
          c.keyword, content.summary, content.reason, category?.id ?? 1,
          status, signal, JSON.stringify(content.evidence),
        ]
      );

      // 키워드를 카드에 연결해야 다음 수집부터 이 카드의 점수가 갱신된다
      await query(`UPDATE keywords SET trend_id = $1 WHERE id = $2`, [trend.id, c.id]);

      keptTrendIds.push(trend.id);
      summary.created += 1;
      summary.trends.push({
        id: trend.id,
        keyword: c.keyword,
        signal,
        generated: content.generated,
        evidenceCount: content.evidence.length,
      });

      // 이미지 생성은 호출당 과금이라 실패해도 카드 생성을 막지 않는다
      if (withImage) {
        try {
          // gatherEvidence()로 이미 확보해둔 실제 뉴스/블로그 발췌를 그대로
          // 재사용한다 — "돼지게티" 같은 신조어도 원문에서 실제 생김새 힌트를
          // 얻어 이미지를 더 정확하게 그릴 수 있다 (추가 API 호출 없음).
          const url = await generateTrendImage(
            String(trend.id),
            c.keyword,
            categorySlug,
            content.summary,
            content.evidence,
          );
          await query(`UPDATE trends SET image_url = $1 WHERE id = $2`, [url, trend.id]);
        } catch (err) {
          console.warn(`[autoTrends] "${c.keyword}" 이미지 생성 실패:`, err);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[autoTrends] "${c.keyword}" 처리 실패:`, message);
      summary.errors.push({ keyword: c.keyword, message });
    }
  }

  // 순위에서 밀린 자동 카드는 내린다 (삭제가 아니라 발행 취소).
  // 즐겨찾기·이력이 걸려 있을 수 있어 지우지 않고, 다시 순위에 들면 되살아난다.
  const retired = await query<{ id: number }>(
    `UPDATE trends
        SET is_published = false, updated_at = now()
      WHERE is_auto = true
        AND is_published = true
        ${keptTrendIds.length > 0 ? `AND id <> ALL($1::bigint[])` : ''}
      RETURNING id`,
    keptTrendIds.length > 0 ? [keptTrendIds] : []
  );
  summary.retired = retired.length;

  // 요청 시에만 수동 카드도 내린다.
  // 자동 카드가 하나도 안 만들어졌다면 내리지 않는다 — 그러면 사이트가 통째로
  // 비어버리기 때문이다. 실제 데이터로 갈아끼우는 게 목적이지 비우는 게 아니다.
  if (retireManual && keptTrendIds.length > 0) {
    const retiredManual = await query<{ id: number }>(
      `UPDATE trends
          SET is_published = false, updated_at = now()
        WHERE is_auto = false AND is_published = true
        RETURNING id`
    );
    summary.retiredManual = retiredManual.length;
  }

  // 1위 트렌드가 바뀌었으면 홈 히어로 배너 전용 이미지를 새로 만든다.
  // 순위가 그대로면 배너도 그대로 둔다 — 매 배치마다 과금하지 않기 위함이다.
  if (withImage) {
    try {
      await refreshTopBanner();
    } catch (err) {
      console.warn('[autoTrends] 배너 이미지 갱신 실패:', err);
    }
  }

  const finishedAt = new Date();
  summary.finishedAt = finishedAt.toISOString();

  console.log(
    `[autoTrends] 완료: 생성 ${summary.created} / 갱신 ${summary.refreshed} / ` +
      `내림 ${summary.retired} / 수동카드 내림 ${summary.retiredManual}`
  );
  return summary;
}

interface TopTrendRow {
  id: number;
  title: string;
  summary: string | null;
  category_slug: string;
  evidence: { title: string; excerpt: string }[] | null;
  banner_image_url: string | null;
}

/**
 * 발행 중인 트렌드 중 최고 점수(1위)를 찾아, 이전 1위와 다르면 배너 이미지를 새로 만든다.
 * 같은 트렌드가 계속 1위면 이미 banner_image_url이 있으니 다시 만들지 않는다.
 */
async function refreshTopBanner(): Promise<void> {
  const [top] = await query<TopTrendRow>(
    `SELECT t.id, t.title, t.summary, c.slug AS category_slug, t.evidence, t.banner_image_url
       FROM trends t
       JOIN categories c ON c.id = t.category_id
      WHERE t.is_published = true
      ORDER BY t.score DESC
      LIMIT 1`
  );

  if (!top || top.banner_image_url) return;

  const evidence = Array.isArray(top.evidence) ? top.evidence : [];
  const url = await generateBannerImage(
    top.id,
    top.title,
    top.category_slug,
    top.summary,
    evidence,
  );
  await query(`UPDATE trends SET banner_image_url = $1 WHERE id = $2`, [url, top.id]);
  console.log(`[autoTrends] 1위 "${top.title}" 배너 이미지 생성 완료`);
}
