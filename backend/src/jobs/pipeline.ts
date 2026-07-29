import cron from 'node-cron';
import { query } from '../db/client';
import { runKeywordDiscovery, DiscoveryJobSummary } from './discoverKeywords';
import { runDailyCollect } from './dailyCollect';
import { refreshAutoTrends, AutoTrendSummary } from './autoTrends';

/**
 * 발굴 → 수집 → 카드 갱신을 자동으로 돌리는 파이프라인.
 *
 * === 왜 필요한가 ===
 *
 * 발굴은 "지금 올라오는 글"에서 키워드를 뽑는다. 하루 한 번만 돌리면 그 시점에
 * 상위에 걸린 글만 보게 되고, 오전·저녁에 뜬 이야기는 놓친다. 자주 돌릴수록
 * 후보 풀이 넓어지고 교차검증(소스 2곳 이상)에 걸리는 키워드도 늘어난다.
 *
 * === 할당량 ===
 *
 * 소스별 하루 한도가 다르고, 발굴 1회 비용도 다르다.
 *
 *   네이버 검색 API   25,000회/일   발굴 1회당 42회  (21개 쿼리 × 블로그·카페)
 *   유튜브 Data API   10,000unit/일 발굴 1회당 505unit (5개 쿼리 × 101unit)
 *   네이버 데이터랩    1,000회/일    발굴에서는 안 쓴다 (수집 단계에서만)
 *
 * 네이버 검색은 사실상 제약이 아니지만(2시간마다 돌려도 하루 504회, 한도의 2%),
 * 유튜브는 발굴 20회면 하루치가 끝난다. 그래서 **주기를 나눴다**:
 *
 *   가벼운 발굴  2시간마다  블로그+카페만        → 하루 504회 (네이버 한도의 2%)
 *   무거운 발굴  하루 2회   위 + 유튜브          → 하루 1,010unit
 *
 * 유튜브 하루 예산:
 *   수집 60키워드 6,060 + 발굴 2회 1,010 = 7,070unit, 수동 실행 여유 2,930unit
 *
 * 처음엔 발굴을 하루 4회로 뒀는데, 수집(80키워드 = 8,080unit)과 합치면
 * 10,100unit이 되어 한도를 넘겼다. 실제로 초과 에러가 나서 둘 다 줄였다.
 *
 * 네이버 검색은 초당 제한도 따로 있다. 그건 naverSearch.ts에서 호출 간격과
 * 429 재시도로 처리한다.
 *
 * === 왜 인메모리 락이 필요한가 ===
 *
 * 스케줄 실행과 관리자 버튼이 겹치면 같은 외부 API를 두 배로 쓴다. 수집은
 * 수 분씩 걸려서 겹칠 여지가 실제로 있다. 프로세스가 하나뿐이라 인메모리
 * 플래그로 충분하다.
 */

type Stage = 'discover' | 'collect' | 'autoRefresh';

export interface PipelineOptions {
  discover?: boolean;
  /** 발굴에 유튜브를 포함할지. 505 unit 소모 */
  youtube?: boolean;
  /** 네이버 쿼리당 페이지 수(1~10). 올릴수록 후보가 늘고 호출도 비례해 는다 */
  pages?: number;
  /**
   * 지난 유행 발굴 모드. 회고 검색어를 정확도순으로 깊게 훑는다.
   * 평소 발굴(최신순)로는 이미 식은 메뉴가 구조적으로 안 잡히기 때문에 필요하다.
   */
  archive?: boolean;
  collect?: boolean;
  autoRefresh?: boolean;
  /** 자동 갱신에서 AI 이미지를 생성할지 (카드당 과금) */
  withImage?: boolean;
  maxNewCards?: number;
  richCount?: number;
}

export interface PipelineRun {
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  /** 아직 돌고 있으면 현재 단계, 끝났으면 null */
  currentStage: Stage | null;
  discovery: DiscoveryJobSummary | null;
  collect: { naverProcessed: number; youtubeProcessed: number; failed: number } | null;
  autoTrends: AutoTrendSummary | null;
  errors: string[];
}

/**
 * 실행 기록을 DB에 남긴다.
 *
 * 왜 메모리만으로는 안 되나: Render 무료 플랜은 15분 무요청이면 프로세스를
 * 내리고, 재배포할 때도 새로 뜬다. 그러면 "방금 뭐가 돌았는지"가 통째로
 * 사라져서, 실행은 정상이었는데 화면에는 null이 뜬다. 실패로 오인하기 쉽다.
 *
 * 기록 실패가 파이프라인을 멈추면 안 되므로 오류는 로그만 남기고 삼킨다.
 * 배치를 돌리는 게 목적이지 기록을 남기는 게 목적이 아니다.
 */
async function insertRunRow(run: PipelineRun): Promise<number | null> {
  try {
    const rows = await query<{ id: number }>(
      `INSERT INTO pipeline_runs (trigger, status, stage, started_at)
       VALUES ($1, 'running', NULL, $2) RETURNING id`,
      [run.trigger.slice(0, 40), run.startedAt]
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    console.warn('[pipeline] 실행 기록 생성 실패:', err);
    return null;
  }
}

async function updateRunRow(id: number | null, run: PipelineRun, done: boolean) {
  if (id === null) return;
  try {
    // 단계가 하나라도 실패했지만 나머지는 돌았으면 'partial'.
    // 아무 결과도 못 얻었으면 'failed'.
    const gotSomething = !!(run.discovery || run.collect || run.autoTrends);
    const status = !done
      ? 'running'
      : run.errors.length === 0
        ? 'success'
        : gotSomething
          ? 'partial'
          : 'failed';

    await query(
      `UPDATE pipeline_runs
          SET status = $2, stage = $3, finished_at = $4, summary = $5::jsonb
        WHERE id = $1`,
      [
        id,
        status,
        run.currentStage,
        run.finishedAt,
        JSON.stringify({
          discovery: run.discovery,
          collect: run.collect,
          autoTrends: run.autoTrends,
          errors: run.errors,
        }),
      ]
    );
  } catch (err) {
    console.warn('[pipeline] 실행 기록 갱신 실패:', err);
  }
}

/** DB에 남은 마지막 실행을 PipelineRun 형태로 복원한다 */
async function loadLastRunFromDb(): Promise<PipelineRun | null> {
  try {
    const rows = await query<{
      trigger: string;
      status: string;
      stage: Stage | null;
      started_at: string;
      finished_at: string | null;
      summary: {
        discovery?: DiscoveryJobSummary | null;
        collect?: PipelineRun['collect'];
        autoTrends?: AutoTrendSummary | null;
        errors?: string[];
      };
    }>(
      `SELECT trigger, status, stage, started_at, finished_at, summary
         FROM pipeline_runs ORDER BY started_at DESC LIMIT 1`
    );
    const r = rows[0];
    if (!r) return null;

    return {
      trigger: r.trigger,
      startedAt: new Date(r.started_at).toISOString(),
      finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
      currentStage: r.stage,
      discovery: r.summary?.discovery ?? null,
      collect: r.summary?.collect ?? null,
      autoTrends: r.summary?.autoTrends ?? null,
      errors: r.summary?.errors ?? [],
    };
  } catch (err) {
    console.warn('[pipeline] 실행 기록 조회 실패:', err);
    return null;
  }
}

/**
 * 자동 갱신 반복 상한.
 * 무한 루프를 막는 안전장치다. 회차당 최대 60장이니 8회면 480장까지 커버된다.
 */
const MAX_AUTO_REFRESH_ROUNDS = 8;

let running = false;
let lastRun: PipelineRun | null = null;

/**
 * 마지막(또는 진행 중인) 실행 상태. 데모 페이지가 폴링해서 보여준다.
 *
 * 메모리에 없으면 DB에서 읽는다. 프로세스가 재시작된 직후에도 직전 실행이
 * 보여야 하기 때문이다.
 *
 * running은 DB가 아니라 메모리 값을 쓴다. DB의 'running' 상태는 프로세스가
 * 도중에 죽으면 영원히 남아 새 실행을 막아버린다. 실제로 지금 이 프로세스가
 * 돌리고 있는지는 메모리만이 안다.
 */
export async function getPipelineStatus(): Promise<{
  running: boolean;
  lastRun: PipelineRun | null;
}> {
  return { running, lastRun: lastRun ?? (await loadLastRunFromDb()) };
}

/** 중복 실행 검사용. DB를 건드리지 않아 동기로 쓸 수 있다 */
export function isPipelineRunning(): boolean {
  return running;
}

/**
 * 파이프라인 1회 실행.
 *
 * 이미 실행 중이면 던지지 않고 null을 돌려준다. 스케줄이 겹치는 건 예외 상황이
 * 아니라 정상적으로 일어나는 일이고(앞 실행이 길어지면 그렇다), 그때는 그냥
 * 건너뛰는 게 맞다.
 */
export async function runPipeline(
  trigger: string,
  options: PipelineOptions = {}
): Promise<PipelineRun | null> {
  if (running) {
    console.warn(`[pipeline] 이미 실행 중이라 "${trigger}" 요청을 건너뜁니다.`);
    return null;
  }

  const {
    discover = true,
    youtube = false,
    pages,
    archive = false,
    collect = false,
    autoRefresh = false,
    withImage = true,
    maxNewCards = 60,
    richCount = 15,
  } = options;

  running = true;
  const run: PipelineRun = {
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    currentStage: null,
    discovery: null,
    collect: null,
    autoTrends: null,
    errors: [],
  };
  lastRun = run;
  const rowId = await insertRunRow(run);

  /**
   * 한 단계가 실패해도 다음 단계는 시도한다.
   * 발굴이 유튜브 할당량 초과로 실패해도 이미 쌓인 후보로 수집·갱신은 할 수 있다.
   */
  async function stage(name: Stage, fn: () => Promise<void>) {
    run.currentStage = name;
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline] ${name} 실패:`, message);
      run.errors.push(`${name}: ${message}`);
    }
    // 단계가 끝날 때마다 기록한다. 도중에 프로세스가 죽어도 어디까지 갔는지 남는다
    await updateRunRow(rowId, run, false);
  }

  try {
    console.log(
      `[pipeline] 시작 (${trigger}) — 발굴=${discover}${archive ? '(지난유행)' : ''} ` +
        `유튜브=${youtube} 수집=${collect} 갱신=${autoRefresh}`
    );

    if (discover) {
      await stage('discover', async () => {
        run.discovery = await runKeywordDiscovery({
          youtube, blog: true, cafe: true, pages, archive,
        });
        run.errors.push(...run.discovery.errors);
      });
    }

    if (collect) {
      await stage('collect', async () => {
        const s = await runDailyCollect();
        run.collect = {
          naverProcessed: s.naverProcessed,
          youtubeProcessed: s.youtubeProcessed,
          failed: s.failed,
        };
      });
    }

    if (autoRefresh) {
      // 후보가 많이 밀려 있으면 한 번에 다 못 만든다.
      // remaining이 0이 되거나 진전이 없을 때까지 이어서 돌린다.
      await stage('autoRefresh', async () => {
        for (let i = 0; i < MAX_AUTO_REFRESH_ROUNDS; i += 1) {
          const summary = await refreshAutoTrends({
            maxNewCards,
            // 이미지는 첫 회차에만. 회차마다 상위 15장씩 새로 그리면 과금이 배로 든다
            richCount: i === 0 ? richCount : 0,
            withImage: i === 0 ? withImage : false,
          });
          run.autoTrends = summary;
          if (summary.remaining === 0 || summary.created === 0) break;
        }
      });
    }
  } finally {
    run.currentStage = null;
    run.finishedAt = new Date().toISOString();
    running = false;
    await updateRunRow(rowId, run, true);
  }

  console.log(`[pipeline] 종료 (${trigger})${run.errors.length ? ` — 오류 ${run.errors.length}건` : ''}`);
  return run;
}

/**
 * 스케줄 등록.
 *
 * 주의: Render 무료 플랜은 15분간 요청이 없으면 인스턴스를 재우고, 잠든 동안에는
 * node-cron이 뜨지 않는다. 그래서 외부에서 주기적으로 깨워줘야 이 스케줄이
 * 의미가 있다. cron-job.org로 GET /health를 10분마다 치면 된다 —
 * 할당량을 전혀 쓰지 않으면서 인스턴스만 깨어 있게 한다.
 *
 * 환경변수로 주기를 바꿀 수 있고, DISABLE_PIPELINE_CRON=true로 끌 수 있다.
 * 시간대는 Asia/Seoul 고정 — Render 컨테이너는 UTC라 그대로 두면 새벽 작업이
 * 오전 중에 돈다.
 */
export function schedulePipeline(): void {
  if (process.env.DISABLE_PIPELINE_CRON === 'true') {
    console.log('[pipeline] DISABLE_PIPELINE_CRON=true — 스케줄을 등록하지 않습니다.');
    return;
  }

  const tz = { timezone: 'Asia/Seoul' };

  // 가벼운 발굴: 1시간마다, 네이버 블로그·카페만.
  // 5페이지 × 21쿼리 × 2코퍼스 = 210회/실행, 하루 24회면 5,040회 (한도의 20%)
  const lightExpr = process.env.DISCOVER_CRON || '0 * * * *';
  cron.schedule(
    lightExpr,
    () => {
      runPipeline('cron:discover-light', { discover: true, youtube: false }).catch((err) =>
        console.error('[pipeline] 가벼운 발굴 실패:', err)
      );
    },
    tz
  );

  // 무거운 발굴: 하루 2회, 유튜브 포함. 2 × 505 = 1,010 unit
  const heavyExpr = process.env.DISCOVER_YOUTUBE_CRON || '30 9,20 * * *';
  cron.schedule(
    heavyExpr,
    () => {
      runPipeline('cron:discover-youtube', { discover: true, youtube: true }).catch((err) =>
        console.error('[pipeline] 유튜브 발굴 실패:', err)
      );
    },
    tz
  );

  // 전체 파이프라인: 하루 1회 새벽. 발굴 + 수집 + 카드 갱신
  const fullExpr = process.env.PIPELINE_CRON || '0 4 * * *';
  cron.schedule(
    fullExpr,
    () => {
      runPipeline('cron:full', {
        discover: true,
        youtube: true,
        collect: true,
        autoRefresh: true,
      }).catch((err) => console.error('[pipeline] 전체 실행 실패:', err));
    },
    tz
  );

  console.log(
    `[pipeline] 스케줄 등록됨 (Asia/Seoul) — 발굴 "${lightExpr}" / ` +
      `유튜브 포함 발굴 "${heavyExpr}" / 전체 "${fullExpr}"`
  );
}
